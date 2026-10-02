// Approved service workflow: additive migration and API-only rollout.
// Effective environment and all other containers are preserved.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

if(process.argv[2]!=='--apply')throw Error('Use --apply for the owner-approved rollout.');
const root=fileURLToPath(new URL('..',import.meta.url));
const envFile=path.join(os.homedir(),'GrideX-runtime/backend/.env');
function run(command,args,options={}){
  const result=spawnSync(command,args,{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,...options});
  if(result.status!==0)throw Error(`${command} failed; output withheld to protect private settings`);
  return result.stdout;
}
const before=JSON.parse(run('docker',['inspect','gridex-mac-gridex-api-1']))[0];
if(before.State.Health?.Status!=='healthy')throw Error('Existing API must be healthy.');
const files=before.Config.Labels['com.docker.compose.project.config_files'].split(',').map(file=>path.join(root,path.basename(file)));
const compose=['--env-file',envFile,'-p','gridex-mac',...files.flatMap(file=>['-f',file])];
const planned=JSON.parse(run('docker-compose',[...compose,'config','--format','json']));
const previousEnv=Object.fromEntries(before.Config.Env.map(entry=>[entry.slice(0,entry.indexOf('=')),entry.slice(entry.indexOf('=')+1)]));
for(const [key,value]of Object.entries(planned.services['gridex-api'].environment))
  if(String(value)!==previousEnv[key])throw Error('Unexpected environment drift: '+key);
const backupRoot=path.join(os.homedir(),'GrideX-runtime/private-backups');
fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});
const backup=fs.mkdtempSync(path.join(backupRoot,'service-admin-'));fs.chmodSync(backup,0o700);
fs.writeFileSync(path.join(backup,'runtime.json'),JSON.stringify(before),{mode:0o600});
const dump=fs.openSync(path.join(backup,'gridex.dump'),'wx',0o600);
try{run('docker',['exec','gridex-mac-gridex-db-1','pg_dump','-U','gridex','-d','gridex','-Fc'],{stdio:['ignore',dump,'pipe']});}finally{fs.closeSync(dump);}
if(fs.statSync(path.join(backup,'gridex.dump')).size<1000)throw Error('Database backup incomplete.');
const rollback='gridex-api-rollback:service-admin-'+Date.now();
run('docker',['tag',before.Image,rollback]);
fs.writeFileSync(path.join(backup,'rollback-image'),rollback,{mode:0o600});
run('docker-compose',[...compose,'build','gridex-api']);
// Migration is transactional and additive. A previous API can still read it.
run('docker',['exec','-i','gridex-mac-gridex-db-1','psql','-v','ON_ERROR_STOP=1','-U','gridex','-d','gridex'],
  {input:fs.readFileSync(path.join(root,'services/gridex-api/migrations/022_service_admin_workflow.sql'),'utf8')});
try{
  run('docker-compose',[...compose,'up','-d','--no-deps','--no-build','gridex-api']);
  let healthy=false;
  for(let i=0;i<25;i++){
    const current=JSON.parse(run('docker',['inspect','gridex-mac-gridex-api-1']))[0];
    if(current.State.Health?.Status==='healthy'&&current.Image!==before.Image){healthy=true;break;}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  if(!healthy)throw Error('Candidate API health failed.');
  console.log('SERVICE_ADMIN_API_HEALTHY backup='+backup+'; settings unchanged; other containers unchanged');
}catch(error){
  run('docker',['tag',rollback,before.Config.Image]);
  run('docker-compose',[...compose,'up','-d','--no-deps','--no-build','--force-recreate','gridex-api']);
  throw error;
}
