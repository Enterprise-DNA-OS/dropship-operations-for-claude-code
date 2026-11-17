import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {table} from './lib/format.mjs';
import {page,table as htmlTable,writeOut} from './lib/render.mjs';

const specs={
 help:[],init:['name','stock-hours'],vendors:[],products:[],orders:[],items:[],shipments:[],returns:[],attention:[],promises:[], 'supplier-review':[], 'stock-review':[], 'route-check':[],compliance:[],insights:['question'],history:[],
 'add-vendor':['name','owner','evidence'], 'review-vendor':['owner','evidence'],
 'add-order':['code','number','order','vendor','currency','placed','delivery','retain','evidence'],
 'add-item':['code','po','sku','name','quantity','cost','promise'],
 confirm:['at','evidence'],promise:['date','evidence'],ship:['reference','quantity','carrier','tracking','date','evidence'],
 deliver:['date','evidence'],return:['reference','quantity','reason','review'], 'resolve-return':['outcome','date'],
 'log-note':['text'],import:['kind','currency','stock-at','placed','retain','delivery','map','dry-run'],export:[], 'draft-chase':[]
};
export const operations=Object.keys(specs);
const writes=new Set(['init','add-vendor','review-vendor','add-order','add-item','confirm','promise','ship','deliver','return','resolve-return','log-note','import']);
const positional={ 'review-vendor':1,confirm:1,promise:1,ship:1,deliver:1,return:1,'resolve-return':1,import:2,'draft-chase':1};
const today=()=>new Date().toISOString().slice(0,10);
export function date(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||'')||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw Error('Date must be a real YYYY-MM-DD');return v;}
function timestamp(v){if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v||''))throw Error('Timestamp needs ISO time and timezone');date(v.slice(0,10));if(!Number.isFinite(Date.parse(v)))throw Error('Invalid timestamp');return new Date(v).toISOString();}
function integer(v,min=0){if(!/^\d+$/.test(String(v))||Number(v)<min||Number(v)>1000000)throw Error(`Quantity must be an integer from ${min} to 1000000`);return Number(v);}
export function cents(v){if(!/^\d+(?:\.\d{1,2})?$/.test(String(v)))throw Error('Money needs a nonnegative decimal with at most two places');let [a,b='']=String(v).split('.');let n=Number(a)*100+Number(b.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>1000000000)throw Error('Money exceeds supported range');return n;}
function currency(v){if(!['NZD','AUD','USD','GBP','EUR','CAD'].includes(v))throw Error('Currency must be NZD, AUD, USD, GBP, EUR or CAD');return v;}
function required(v,label){if(typeof v!=='string'||!v.trim())throw Error(`Missing ${label}`);return v.trim();}
function bool(v){if(['true','1','yes'].includes(String(v).toLowerCase()))return true;if(['false','0','no'].includes(String(v).toLowerCase()))return false;throw Error('Boolean must be true/false, yes/no or 1/0');}
function parse(args){const [cmd='help',...rest]=args; if(!specs[cmd])throw Error(`Unknown command ${cmd}`);const flags={},pos=[];
 for(const a of rest){if(a.startsWith('--')){let [k,...vs]=a.slice(2).split('=');if(!['json','by',...specs[cmd]].includes(k))throw Error(`Unknown option --${k}`);if(k in flags)throw Error(`Duplicate option --${k}`);flags[k]=vs.length?vs.join('='):true;if(['json','dry-run'].includes(k)){if(flags[k]!==true)throw Error(`--${k} takes no value`);}else if(flags[k]===true)throw Error(`--${k}=value required`);}else pos.push(a);}
 if(pos.length!==(positional[cmd]||0))throw Error(`${cmd} expects ${positional[cmd]||0} positional arguments`);return {cmd,f:flags,pos};}
async function resolve(db,t,q,cols){required(q,'record');const rows=await db.query(`select * from ${t}`);const exact=rows.filter(r=>cols.some(c=>String(r[c]??'').toLowerCase()===q.toLowerCase()));const found=exact.length?exact:rows.filter(r=>String(r.id).startsWith(q)||cols.some(c=>String(r[c]??'').toLowerCase().includes(q.toLowerCase())));if(found.length!==1)throw Error(`${found.length?'Ambiguous':'No matching'} ${t}: ${found.map(r=>[r.id,...cols.map(c=>r[c])].join(' | ')).join('\n')}`);return found[0];}
async function ensureVendor(db,name){required(name,'vendor');let rows=await db.query('select * from vendors where lower(name)=lower($1)',[name]);if(rows.length)return rows[0];return (await db.query('insert into vendors(name) values($1) returning *',[name]))[0];}
const item=(db,q)=>resolve(db,'items',q,['source_id','name']);
const po=(db,q)=>resolve(db,'purchase_orders',q,['number','source_id','customer_order']);
async function balances(db,id){return(await db.query('select * from v_balances where id=$1',[id]))[0];}

export const insightSpecs=[
 ['Which unconfirmed lines are already late?',"select number,vendor,source_id,outstanding from v_balances where late and unconfirmed order by number"],
 ['Which customer orders are split across suppliers?',"select customer_order,count(distinct vendor_id)::integer suppliers from purchase_orders group by customer_order having count(distinct vendor_id)>1 order by customer_order"],
 ['Which remaining lines rely on stale supplier stock?',"select b.number,b.vendor,b.vendor_sku,b.outstanding,s.available from v_balances b join purchase_orders p on p.id=b.po_id join v_stock s on s.vendor_id=p.vendor_id and s.vendor_sku=b.vendor_sku where b.outstanding>0 and s.stale order by b.number"],
 ['Which products have a negative unit spread before freight?',"select retailer_sku,vendor,currency,unit_spread_cents from v_stock where unit_spread_cents<0 order by retailer_sku"],
 ['Which late orders still have no evidenced delivery?',"select number,vendor,source_id,delivery_due,delivery_evidenced,quantity from v_balances where delivery_due<current_date and delivery_evidenced<quantity order by number"],
 ['Which suppliers carry the largest outstanding cost by currency?',"select name,currency,outstanding_cost_cents from v_supplier_review where outstanding_cost_cents>0 order by currency,outstanding_cost_cents desc,name"],
 ['Which partially shipped lines are still overdue?',"select number,vendor,source_id,shipped,outstanding from v_balances where late and shipped>0 order by number"],
 ['Which returned items still need a decision?',"select r.reference,b.number,b.vendor,r.quantity,r.reason,r.review_due from returns r join v_balances b on b.id=r.item_id where r.resolved_on is null order by r.review_due,r.reference"],
 ['Which purchase orders need a retention review?',"select number,customer_order,retention_review from purchase_orders where retention_review<current_date order by number"],
 ['Which active stock records lack an accountable supplier owner?',"select s.retailer_sku,s.vendor,s.available from v_stock s join vendors v on v.id=s.vendor_id where s.active and v.owner='' order by s.retailer_sku"]
];
async function compliance(db){let rows=await db.query(`select 'DELIVERY-REVIEW' rule,number reference,'Recorded delivery deadline passed without complete delivery evidence' finding from v_balances where delivery_due<current_date and delivery_evidenced<quantity
 union all select 'RETENTION-REVIEW',number,'Business-set retention review date passed' from purchase_orders where retention_review<current_date
 union all select 'SUPPLIER-OWNER',name,'Assign an owner and evidence for the supplier relationship' from vendors where owner='' or evidence=''
 union all select 'SOURCE-EVIDENCE',number,'Purchase order has no evidence reference' from purchase_orders where evidence=''
 union all select 'MISSING-DELIVERY',number,'No customer delivery expectation recorded' from purchase_orders where delivery_due is null
 union all select 'MISSING-SHIP-PROMISE',number,'An outstanding line has no ship promise' from v_balances where promise_on is null and outstanding>0 order by rule,reference`);
 return rows.map(r=>({...r,source:r.rule==='RETENTION-REVIEW'?'https://www.privacy.org.nz/privacy-principles/9/':r.rule==='DELIVERY-REVIEW'?'https://www.consumerprotection.govt.nz/general-help/common-consumer-issues/delivery-issues':'docs/compliance.md#internal-controls'}));}

async function importFile(db,f,pos){if(pos[0]!=='duoplane')throw Error('Import source must be duoplane');if(!['products','orders'].includes(f.kind))throw Error('--kind=products|orders required');
 const raw=fs.readFileSync(pos[1],'utf8'),rows=parseCsv(raw);if(!rows.length)throw Error('CSV is empty');const mapping=f.map?JSON.parse(fs.readFileSync(f.map,'utf8')):{};
 if(!mapping||Array.isArray(mapping)||typeof mapping!=='object'||Object.values(mapping).some(v=>typeof v!=='string'))throw Error('Mapping must be canonical field to CSV heading');
 const get=(r,k,...aliases)=>required(mapping[k]?pick(r,mapping[k]):pick(r,k,...aliases),k);
 const optional=(r,k,...aliases)=>mapping[k]?pick(r,mapping[k]):pick(r,k,...aliases);
 const cur=currency(f.currency),seen=new Set();let updated=0,unchanged=0;
 for(const r of rows){
  if(f.kind==='products'){
   const source=get(r,'id');if(seen.has(source))throw Error('Duplicate input product id');seen.add(source);
   const at=timestamp(f['stock-at']);if(Date.parse(at)>Date.now()+60000)throw Error('Stock timestamp is in the future');
   const vendor=await ensureVendor(db,get(r,'vendor_name'));const fields=[vendor.id,get(r,'retailer_sku'),get(r,'vendor_sku'),get(r,'name'),cur,cents(get(r,'cost')),cents(get(r,'price')),integer(get(r,'quantity_available')),bool(get(r,'active')),at,path.basename(pos[1])];
   const existing=(await db.query('select * from products where source_id=$1',[source]))[0];if(existing&&Date.parse(existing.stock_at)>Date.parse(at))throw Error('Stale import would rewind the stock snapshot');
   await db.query(`insert into products(source_id,vendor_id,retailer_sku,vendor_sku,name,currency,cost_cents,price_cents,available,active,stock_at,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    on conflict(source_id) do update set vendor_id=excluded.vendor_id,retailer_sku=excluded.retailer_sku,vendor_sku=excluded.vendor_sku,name=excluded.name,currency=excluded.currency,cost_cents=excluded.cost_cents,price_cents=excluded.price_cents,available=excluded.available,active=excluded.active,stock_at=excluded.stock_at,source=excluded.source`,[source,...fields]);updated++;
  }else{
   const sid=get(r,'item_id','Order Item ID');if(seen.has(sid))throw Error('Duplicate input order item id');seen.add(sid);
   const poid=get(r,'po_id','Purchase Order ID'),number=get(r,'number','Purchase Order'),vendor=await ensureVendor(db,get(r,'vendor','Vendor name'));
   const order=get(r,'customer_order','Customer Order'),placed=date(f.placed||get(r,'placed_on','Order Date')),retain=date(f.retain||get(r,'retention_review','Retention Review'));
   if(placed>today())throw Error('Placed date cannot be in the future');if(retain<placed)throw Error('Retention review predates order');
   const delivery=f.delivery||optional(r,'delivery_due','Delivery Due'),confirmed=optional(r,'confirmed_at','PO Confirmation Time');
   if(delivery&&date(delivery)<placed)throw Error('Delivery date predates order');if(confirmed)timestamp(confirmed);
   let existing=(await db.query('select * from purchase_orders where source_id=$1',[poid]))[0];
   if(existing){if(existing.number!==number||existing.vendor_id!==vendor.id||existing.customer_order!==order||existing.currency!==cur||existing.placed_on!==placed)throw Error('Existing purchase order identity differs');}
   else existing=(await db.query('insert into purchase_orders(source_id,number,customer_order,vendor_id,currency,placed_on,confirmed_at,delivery_due,retention_review,evidence) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[poid,number,order,vendor.id,cur,placed,confirmed||null,delivery||null,retain,path.basename(pos[1])]))[0];
   const qty=integer(get(r,'quantity','Quantity'),1),base=integer(get(r,'shipped','Shipped Quantity')),cost=cents(get(r,'cost','Item Cost Each')),sku=get(r,'sku','Vendor SKU'),name=get(r,'name','Item Name'),promise=optional(r,'promise','Promise Date');
   if(base>qty)throw Error('Shipped quantity exceeds ordered');if(promise&&date(promise)<placed)throw Error('Promise predates order');
   const old=(await db.query('select * from items where source_id=$1',[sid]))[0];
   if(old){if(old.po_id!==existing.id||old.quantity!==qty||old.baseline_shipped!==base||Number(old.unit_cost_cents)!==cost||old.vendor_sku!==sku||old.name!==name||old.promise_on!==(promise||null))throw Error('Existing line differs; use reviewed operational commands instead of overwriting history');unchanged++;}
   else{await db.query('insert into items(source_id,po_id,vendor_sku,name,quantity,baseline_shipped,unit_cost_cents,promise_on) values($1,$2,$3,$4,$5,$6,$7,$8)',[sid,existing.id,sku,name,qty,base,cost,promise||null]);updated++;}
  }
 }
 const digest=createHash('sha256').update(raw+JSON.stringify(mapping)).digest('hex');await db.query('insert into imports(kind,digest,rows,source,operator) values($1,$2,$3,$4,$5)',[f.kind,digest,rows.length,path.basename(pos[1]),f.by]);return {kind:f.kind,rows:rows.length,updated,unchanged,dry_run:!!f['dry-run'],digest};
}
async function perform(db,cmd,f,pos){const need=k=>required(f[k],`--${k}`);
 if(cmd==='help')return {commands:operations,syntax:'node scripts/dropship.mjs COMMAND [record] --key=value --json; mutations require --by=Name',reference:'docs/cli.md'};
 if(cmd==='init'){if((await db.query('select * from workspace')).length)throw Error('Workspace already initialised');const hours=f['stock-hours']?integer(f['stock-hours'],1):48;if(hours>720)throw Error('Stock hours maximum 720');await db.query('insert into workspace(id,name,stock_hours) values(1,$1,$2)',[need('name'),hours]);return {initialised:true};}
 const views={vendors:'select id,name,owner,evidence from vendors order by name',products:'select source_id,retailer_sku,vendor,name,currency,available,stale from v_stock order by source_id',orders:'select p.source_id,p.number,p.customer_order,v.name vendor,p.currency,p.placed_on,p.confirmed_at,p.delivery_due from purchase_orders p join vendors v on v.id=p.vendor_id order by number',items:'select source_id,number,vendor,name,quantity,shipped,outstanding,promise_on from v_balances order by number,source_id',shipments:'select s.id,s.reference,b.number,b.source_id,s.quantity,s.carrier,s.tracking,s.shipped_on,s.delivered_on from shipments s join v_balances b on b.id=s.item_id order by s.reference',returns:'select reference,quantity,reason,review_due,outcome from returns order by reference',attention:'select * from v_attention order by rule,reference,detail',promises:'select number,vendor,source_id,promise_on,outstanding,late from v_balances where outstanding>0 order by promise_on nulls first,number', 'supplier-review':'select name,currency,lines,units_outstanding,late_lines,unconfirmed_lines,outstanding_cost_cents from v_supplier_review order by name,currency','stock-review':'select source_id,retailer_sku,vendor,available,stock_at,stale,active from v_stock order by source_id',history:'select action,operator,detail,created_at from history order by created_at,id', 'route-check':`select b.number,b.source_id,b.vendor,b.vendor_sku,b.outstanding,s.available,coalesce(s.stale,true) stale,case when s.id is null then 'NO-STOCK-RECORD' when s.stale then 'REFRESH-STOCK' when not s.active then 'INACTIVE' when s.available<b.outstanding then 'SHORT' else 'CHECK-RESERVATION' end decision from v_balances b join purchase_orders p on p.id=b.po_id left join v_stock s on s.vendor_id=p.vendor_id and s.vendor_sku=b.vendor_sku where b.outstanding>0 order by b.number`};
 if(views[cmd])return db.query(views[cmd]);
 if(cmd==='compliance')return compliance(db);
 if(cmd==='insights'){if(f.question&&(!/^\d+$/.test(f.question)||Number(f.question)<1||Number(f.question)>10))throw Error('Question must be 1 to 10');const out=[];for(let i=0;i<10;i++){if(f.question&&Number(f.question)!==i+1)continue;out.push({question:insightSpecs[i][0],rows:await db.query(insightSpecs[i][1])});}return out;}
 if(cmd==='add-vendor')return (await db.query('insert into vendors(name,owner,evidence) values($1,$2,$3) returning id,name',[need('name'),need('owner'),need('evidence')]))[0];
 if(cmd==='review-vendor'){const v=await resolve(db,'vendors',pos[0],['name']);await db.query('update vendors set owner=$1,evidence=$2 where id=$3',[need('owner'),need('evidence'),v.id]);return {vendor:v.name,reviewed:true};}
 if(cmd==='add-order'){const v=await resolve(db,'vendors',need('vendor'),['name']),placed=date(need('placed')),retain=date(need('retain')),delivery=f.delivery?date(f.delivery):null;if(placed>today()||retain<placed||(delivery&&delivery<placed))throw Error('Order dates are inconsistent');return (await db.query('insert into purchase_orders(source_id,number,customer_order,vendor_id,currency,placed_on,delivery_due,retention_review,evidence) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id,number',[need('code'),need('number'),need('order'),v.id,currency(need('currency')),placed,delivery,retain,need('evidence')]))[0];}
 if(cmd==='add-item'){const p=await po(db,need('po')),promise=f.promise?date(f.promise):null;if(promise&&promise<p.placed_on)throw Error('Promise predates order');return (await db.query('insert into items(source_id,po_id,vendor_sku,name,quantity,unit_cost_cents,promise_on) values($1,$2,$3,$4,$5,$6,$7) returning id,source_id',[need('code'),p.id,need('sku'),need('name'),integer(need('quantity'),1),cents(need('cost')),promise]))[0];}
 if(cmd==='confirm'){const p=await po(db,pos[0]),at=timestamp(need('at'));need('evidence');if(Date.parse(at)>Date.now()||at.slice(0,10)<p.placed_on)throw Error('Confirmation time outside order history');if(p.confirmed_at)throw Error('Already confirmed');await db.query('update purchase_orders set confirmed_at=$1 where id=$2',[at,p.id]);return {number:p.number,confirmed_at:at};}
 if(cmd==='promise'){const i=await item(db,pos[0]),p=await po(db,i.po_id),d=date(need('date'));need('evidence');if(d<p.placed_on)throw Error('Promise predates order');await db.query('update items set promise_on=$1 where id=$2',[d,i.id]);return {line:i.source_id,promise_on:d};}
 if(cmd==='ship'){const i=await item(db,pos[0]),b=await balances(db,i.id),p=await po(db,i.po_id),n=integer(need('quantity'),1),d=date(need('date'));if(n>b.outstanding)throw Error('Shipment exceeds outstanding quantity');if(!p.confirmed_at)throw Error('Confirm supplier receipt before recording shipment');if(d<p.placed_on||d>today())throw Error('Shipment date outside order history');return(await db.query('insert into shipments(item_id,reference,quantity,carrier,tracking,shipped_on,evidence,operator) values($1,$2,$3,$4,$5,$6,$7,$8) returning id,reference,quantity',[i.id,need('reference'),n,need('carrier'),need('tracking'),d,need('evidence'),f.by]))[0];}
 if(cmd==='deliver'){const s=await resolve(db,'shipments',pos[0],['reference','tracking']),d=date(need('date'));if(s.delivered_on)throw Error('Already delivered');if(d<s.shipped_on||d>today())throw Error('Delivery date outside shipment history');need('evidence');await db.query('update shipments set delivered_on=$1 where id=$2',[d,s.id]);return {shipment:s.reference,delivered_on:d};}
 if(cmd==='return'){const i=await item(db,pos[0]),b=await balances(db,i.id),n=integer(need('quantity'),1);if(n>b.shipped-b.returned)throw Error('Return exceeds unreturned shipped quantity');return(await db.query('insert into returns(item_id,reference,quantity,reason,review_due,operator) values($1,$2,$3,$4,$5,$6) returning id,reference',[i.id,need('reference'),n,need('reason'),date(need('review')),f.by]))[0];}
 if(cmd==='resolve-return'){const r=await resolve(db,'returns',pos[0],['reference']);if(r.resolved_on)throw Error('Return already resolved');const d=date(need('date'));if(d>today()||d<new Date(r.created_at).toISOString().slice(0,10))throw Error('Resolution date outside case history');await db.query('update returns set outcome=$1,resolved_on=$2 where id=$3',[need('outcome'),d,r.id]);return {reference:r.reference,resolved_on:d};}
 if(cmd==='log-note')return {note:need('text')};
 if(cmd==='import')return importFile(db,f,pos);
 if(cmd==='export'){const out={format:'dropship-operations-v1',exported_at:new Date().toISOString()};for(const t of ['workspace','vendors','products','purchase_orders','items','shipments','returns','history','imports'])out[t]=await db.query(`select * from ${t} order by id`);const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'exports');fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,`records-${Date.now()}.json`);fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n',{mode:0o600});return {file,format:out.format};}
 if(cmd==='draft-chase'){const v=await resolve(db,'vendors',pos[0],['name']),rows=await db.query('select number,source_id,name,promise_on,outstanding,late from v_balances where vendor=$1 and outstanding>0 order by number',[v.name]);const file=writeOut('drafts',`supplier-chase-${v.id}`,page({title:'Draft supplier follow-up',subtitle:v.name,sections:[{title:'Outstanding lines',note:'Private draft. Review the quantities and latest supplier response before sending.',html:htmlTable(rows)}]}));return {file,lines:rows.length,sent:false};}
 throw Error('Unhandled command');
}
export async function run(db,args){const {cmd,f,pos}=parse(args);if(writes.has(cmd))required(f.by,'--by');
 if(cmd==='help')return perform(db,cmd,f,pos);
 await db.exec(writes.has(cmd)?'BEGIN':'BEGIN READ ONLY');
 try{
  if(cmd!=='init'){const ws=await db.query('select * from workspace'+(writes.has(cmd)?' for update':''));if(!ws.length)throw Error('Run init before using the workspace');}
  const result=await perform(db,cmd,f,pos);
  if(writes.has(cmd))await db.query('insert into history(action,operator,detail) values($1,$2,$3)',[cmd,f.by,JSON.stringify({arguments:pos,options:Object.fromEntries(Object.entries(f).filter(([k])=>k!=='json')),result})]);
  await db.exec(f['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
export function print(value){if(Array.isArray(value)){if(!value.length)return '(none)';if(value[0].question)return value.map(x=>x.question+'\n'+print(x.rows)).join('\n\n');return table(value,Object.keys(value[0]).map(key=>({key,label:key.replace(/_cents$/, ''),format:v=>key.endsWith('_cents')?(Number(v)/100).toFixed(2):v instanceof Date?v.toISOString():typeof v==='object'?JSON.stringify(v):v})));}return JSON.stringify(value,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const value=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(value):print(value));}catch(e){console.error(e.message);process.exitCode=1;}finally{await db?.close();}}
