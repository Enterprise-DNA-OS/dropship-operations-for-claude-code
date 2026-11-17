import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';
import {getDb,REPO_ROOT} from './lib/db.mjs';import {migrate} from './migrate.mjs';import {seed} from './seed.mjs';import {run,print} from './dropship.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dropship-demo-'));process.env.DATABASE_URL='';process.env.DATA_DIR=path.join(dir,'db');process.env.OUTPUT_DIR=dir;let db;
try{db=await getDb();await migrate(db);await seed(db);const screens=[];
 for(const [command,title,ask] of [['promises','Supplier promises','Which supplier promises need attention?'],['route-check','Stock behind open orders','Can the recorded supplier stock cover our outstanding lines?'],['supplier-review','Supplier review','Which suppliers hold our unfinished orders?']]){const output=print(await run(db,[command]));console.log('\n'+title+'\n'+output);screens.push({title,ask,command:'node scripts/dropship.mjs '+command,output});}
 await db.close();db=null;for(const f of ['docs.mjs','view.mjs']){const child=spawnSync(process.execPath,[path.join(REPO_ROOT,'scripts',f)],{env:process.env,encoding:'utf8'});if(child.status!==0)throw Error(child.stderr);console.log(child.stdout);}
 fs.writeFileSync(path.join(dir,'screens.json'),JSON.stringify(screens,null,2));console.log('Demo directory: '+dir);
}finally{await db?.close();if(!process.argv.includes('--keep'))fs.rmSync(dir,{recursive:true,force:true});}
