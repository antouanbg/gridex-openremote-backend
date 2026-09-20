import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const [envFile,backupRoot,email,mode]=process.argv.slice(2);
if(!email||!['--inspect','--apply'].includes(mode)) throw Error('Usage PRIVATE_ENV PRIVATE_BACKUPS OWNER_EMAIL --inspect|--apply');
const env=parseEnv(fs.readFileSync(envFile,'utf8'));
const backup=fs.mkdtempSync(path.join(backupRoot,'inventory-or-'));
fs.chmodSync(backup,0o700);
const source=fs.readFileSync(new URL('./reconcile-pilot-inventory-inner.mjs',import.meta.url),'utf8');
const migration=fs.readFileSync(new URL('../services/gridex-api/migrations/009_gateway_openremote_bindings.sql',import.meta.url),'utf8');
function run(apply){
 const result=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD,email,bindings:JSON.parse(env.GRIDEX_HEARTBEAT_BINDINGS),history:JSON.parse(env.GRIDEX_HISTORY_BINDINGS),writerId:env.GRIDEX_HISTORY_WRITER_CLIENT_ID,writerSecret:env.GRIDEX_HISTORY_WRITER_CLIENT_SECRET,apply,migration}),encoding:'utf8',maxBuffer:16*1024*1024});
 fs.writeFileSync(path.join(backup,apply?'result.json':'before.json'),result.stdout,{mode:0o600});
 if(result.status!==0){fs.writeFileSync(path.join(backup,'failure.log'),result.stderr,{mode:0o600});throw Error('Reconciliation incomplete; inspect private diagnostics: '+backup);}
 return JSON.parse(result.stdout);
}
const before=run(false);
console.log('Verified owner and pilot: '+before.gateways.length+' local gateways, '+before.assets.length+' OpenRemote assets. Private snapshot: '+backup);
if(mode==='--apply'){
 for(const [container,user,database,file] of [['gridex-mac-gridex-db-1','gridex','gridex','gridex.dump'],['gridex-mac-postgresql-1','postgres','openremote','openremote.dump']]){
  const dump=spawnSync('docker',['--context','colima-gridex','exec',container,'pg_dump','-U',user,'-d',database,'-Fc'],{maxBuffer:256*1024*1024});
  if(dump.status!==0||dump.stdout.subarray(0,5).toString()!=='PGDMP') throw Error('Backup failed; no inventory changes applied');
  const verify=spawnSync('docker',['--context','colima-gridex','exec','-i',container,'pg_restore','--list'],{input:dump.stdout,maxBuffer:16*1024*1024});
  if(verify.status!==0) throw Error('Backup index validation failed');
  fs.writeFileSync(path.join(backup,file),dump.stdout,{mode:0o600});
 }
 const result=run(true);
 console.log('OpenRemote hierarchy and '+result.ownerLinkedAssets+' owner links verified. Device/network/control settings unchanged. Private record: '+backup);
}
