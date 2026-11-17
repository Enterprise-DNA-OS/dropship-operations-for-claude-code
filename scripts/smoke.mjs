import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';import {migrate} from './migrate.mjs';import {seed} from './seed.mjs';import {run,operations,cents,date} from './dropship.mjs';import {parseCsv} from './lib/csv.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dropship-test-'));process.env.DATABASE_URL=process.env.TEST_DATABASE_URL||'';process.env.DATA_DIR=path.join(dir,'db');process.env.OUTPUT_DIR=dir;
let db,n=0;const seen=new Set(),by='--by=Test operator';const eq=(a,b)=>{assert.deepEqual(a,b);n++;},ok=x=>{assert.ok(x);n++;};
const call=(...a)=>{seen.add(a[0]);return run(db,a);};const fail=async(a,re)=>{await assert.rejects(()=>call(...a),re);n++;};
const productArgs=['import','duoplane',path.join(REPO_ROOT,'examples/products.csv'),'--kind=products','--currency=NZD','--stock-at=2026-11-01T00:00:00Z',by];
const orderArgs=['import','duoplane',path.join(REPO_ROOT,'examples/orders.csv'),'--kind=orders','--currency=NZD',by];
try{
 db=await getDb();eq((await migrate(db)).ran.length,1);eq((await migrate(db)).ran.length,0);ok((await call('help')).commands.includes('ship'));await fail(['orders'],/init/);
 await call('init','--name=Test Retailer',by);await fail(['init','--name=Again',by],/already/);await assert.rejects(()=>seed(db),/business workspace/);n++;
 eq((await call(...productArgs,'--dry-run')).rows,2);eq((await call('products')).length,0);eq((await call('vendors')).length,0);eq((await call('history')).length,1);
 await call(...productArgs);await call(...productArgs);eq((await call('products')).length,2);
 await fail([...productArgs.filter(x=>!x.startsWith('--stock-at=')),'--stock-at=2026-10-01T00:00:00Z'],/rewind/);
 eq((await call(...orderArgs,'--dry-run')).updated,2);eq((await call('orders')).length,0);await call(...orderArgs);eq((await call(...orderArgs)).unchanged,2);
 eq((await call('items')).map(x=>x.outstanding),[8,3]);eq((await call('supplier-review'))[0].outstanding_cost_cents,46500);
 const mapped=path.join(dir,'mapped.csv');fs.writeFileSync(mapped,fs.readFileSync(path.join(REPO_ROOT,'examples/orders.csv'),'utf8').replace('Quantity,Shipped Quantity','Units ordered,Units already shipped'));
 eq((await call('import','duoplane',mapped,'--kind=orders','--currency=NZD',`--map=${path.join(REPO_ROOT,'examples/column-map.json')}`,by)).unchanged,2);
 const bad=path.join(dir,'bad.csv');fs.writeFileSync(bad,fs.readFileSync(path.join(REPO_ROOT,'examples/products.csv'),'utf8').replace('D-1,','D-3,').replace('CO-LAMP','NEW-LAMP').replace('D-2,Wool','D-4,Wool').replace(',35.00,',',oops,'));
 await fail(['import','duoplane',bad,'--kind=products','--currency=NZD','--stock-at=2026-11-01T00:00:00Z',by],/Money/);eq((await call('products')).length,2);
 fs.writeFileSync(bad,fs.readFileSync(path.join(REPO_ROOT,'examples/orders.csv'),'utf8').replace('I-2','I-1'));await fail(['import','duoplane',bad,'--kind=orders','--currency=NZD',by],/Duplicate input/);
 fs.writeFileSync(bad,fs.readFileSync(path.join(REPO_ROOT,'examples/orders.csv'),'utf8').replace('10,2,45.00','11,2,45.00'));await fail(['import','duoplane',bad,'--kind=orders','--currency=NZD',by],/Existing line differs/);
 await call('review-vendor','coastal','--owner=Aroha','--evidence=Checked agreement',by);
 await call('add-vendor','--name=Coastal Outdoor','--owner=Moana','--evidence=Agreement',by);
 await fail(['review-vendor','Coast','--owner=Moana','--evidence=Agreement',by],/Ambiguous[\s\S]*Coastal/);
 await call('add-order','--code=P-2','--number=DP-200','--order=SHOP-100','--vendor=Coastal Outdoor','--currency=AUD','--placed=2026-11-01','--delivery=2026-11-30','--retain=2027-11-01','--evidence=Order export',by);
 await call('add-item','--code=I-3','--po=DP-200','--sku=NEW','--name=Chair','--quantity=4','--cost=12.50','--promise=2026-11-20',by);
 await fail(['ship','I-3','--reference=S-0','--quantity=1','--carrier=Courier','--tracking=TRACK','--date=2026-11-03','--evidence=Dispatch',by],/Confirm/);
 await call('confirm','dp-200','--at=2026-11-02T10:00:00Z','--evidence=Supplier note',by);
 await fail(['confirm','DP-200','--at=2026-11-02T10:00:00Z','--evidence=Note',by],/Already/);
 await call('promise','i-3','--date=2026-11-15','--evidence=Updated supplier promise',by);
 const s=await call('ship','i-3','--reference=S-3','--quantity=2','--carrier=Courier','--tracking=TRACK-3','--date=2026-11-10','--evidence=Dispatch slip',by);ok(s.id);
 eq((await call('items')).find(x=>x.source_id==='I-3').outstanding,2);
 await fail(['ship','I-3','--reference=S-4','--quantity=3','--carrier=C','--tracking=T','--date=2026-11-10','--evidence=E',by],/exceeds/);
 await fail(['ship','I-3','--reference=S-3','--quantity=1','--carrier=C','--tracking=T','--date=2026-11-10','--evidence=E',by],/unique/);
 await fail(['deliver','S-3','--date=2026-11-09','--evidence=Receipt',by],/outside/);
 await call('deliver','TRACK-3','--date=2026-11-11','--evidence=Delivery receipt',by);
 await call('return','I-3','--reference=R-3','--quantity=1','--reason=Damaged','--review=2026-11-12',by);
 await fail(['return','I-3','--reference=R-4','--quantity=2','--reason=Damaged','--review=2026-11-12',by],/exceeds/);
 await call('resolve-return','R-3','--outcome=Replacement agreed with supplier',`--date=${new Date().toISOString().slice(0,10)}`,by);
 await fail(['resolve-return','R-3','--outcome=Again',`--date=${new Date().toISOString().slice(0,10)}`,by],/already/);
 await call('log-note','--text=<script>private</script>',by);
 for(const cmd of ['vendors','products','orders','items','shipments','returns','attention','promises','supplier-review','stock-review','route-check','compliance','history'])ok(Array.isArray(await call(cmd)));
 eq((await call('insights')).length,10);eq((await call('insights','--question=2'))[0].rows[0].suppliers,2);await fail(['insights','--question=11'],/1 to 10/);
 ok((await call('route-check')).every(x=>x.decision!=='AVAILABLE'));ok((await call('compliance')).some(x=>x.rule==='DELIVERY-REVIEW'));
 const draft=await call('draft-chase','Coastal Supply');eq(draft.sent,false);ok(fs.readFileSync(draft.file,'utf8').includes('Outstanding lines'));
 const exported=await call('export'),archive=JSON.parse(fs.readFileSync(exported.file));eq(archive.format,'dropship-operations-v1');eq(archive.items.length,3);eq(archive.shipments.length,1);ok(archive.history.some(x=>x.action==='deliver'));
 for(const t of ['history','imports']){await assert.rejects(()=>db.exec(`delete from ${t}`),/Append-only/);n++;}
 await fail(['orders','--bogus'],/Unknown/);await fail(['orders','oops'],/expects/);await fail(['add-vendor','--name=X'],/--by/);await fail(['nonexistent'],/Unknown/);
 eq(cents('12.50'),1250);for(const x of ['-1','1.001','NaN','1e3','1,000']){assert.throws(()=>cents(x));n++;}assert.throws(()=>date('2026-02-30'));n++;
 eq(parseCsv('\ufeffa,b\r\n"x\ny","a""b"\r\n'),[{a:'x\ny',b:'a"b'}]);for(const x of ['a,a\n1,2','a,b\n1','a,b\n"oops,2']){assert.throws(()=>parseCsv(x));n++;}
 await db.close();db=null;
 const launch=(name,args=[])=>spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',name),...args],{env:process.env,encoding:'utf8'});
 for(const f of ['view.mjs','docs.mjs']){let p=launch(f);assert.equal(p.status,0,p.stderr);n++;}
 eq(fs.readdirSync(path.join(dir,'views')).length,3);eq(fs.readdirSync(path.join(dir,'docs-out/purchase-order')).length,2);
 let p=launch('dropship.mjs',['items','--json']);eq(p.status,0);eq(JSON.parse(p.stdout).length,3);eq(launch('dropship.mjs',['review-vendor','Coast','--owner=X','--evidence=Y',by]).status,1);
 process.env.DATABASE_URL='';process.env.DATA_DIR=path.join(dir,'seed');db=await getDb();await migrate(db);await seed(db);await seed(db);eq((await run(db,['items'])).length,3);eq((await run(db,['shipments'])).length,2);ok((await run(db,['attention'])).length>=3);
 eq(operations.filter(c=>!seen.has(c)),[]);console.log(`PASS: ${n} assertions; all ${operations.length} CLI operations; import rollback, quantities, ambiguity, partial shipments, returns, reports and isolation`);
}finally{await db?.close();fs.rmSync(dir,{recursive:true,force:true});}
