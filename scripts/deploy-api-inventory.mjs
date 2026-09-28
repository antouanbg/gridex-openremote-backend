// Rebuild/recreate only the existing API service, preserving effective settings.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
const [envFile,backupRoot,apply]=process.argv.slice(2);
if(apply!=='--apply')throw Error('Usage PRIVATE_ENV PRIVATE_BACKUPS --apply');
const docker=['--context','colima-gridex'];
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(command,args,options={}){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024,...options});if(r.status!==0)throw Error(command+' failed; no command output printed to protect settings');return r.stdout;}
const before=JSON.parse(run('docker',[...docker,'inspect','gridex-mac-gridex-api-1']))[0];
const previousFiles=before.Config.Labels['com.docker.compose.project.config_files'].split(',');
const files=previousFiles.map(f=>path.join(root,path.basename(f)));
if(files.some(f=>!fs.existsSync(f)))throw Error('A current Compose manifest is missing');
const compose=['--env-file',envFile,'-p','gridex-mac',...files.flatMap(f=>['-f',f])];
const options={env:{...process.env,DOCKER_CONTEXT:'colima-gridex'}};
const planned=JSON.parse(run('docker-compose',[...compose,'config','--format','json'],options));
const currentEnv=Object.fromEntries(before.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
for(const [key,value]of Object.entries(planned.services['gridex-api'].environment)){
 if(String(value)!==currentEnv[key])throw Error('Environment drift detected for '+key+'; stop before restart');
}
const backup=fs.mkdtempSync(path.join(backupRoot,'api-inventory-'));fs.chmodSync(backup,0o700);
fs.writeFileSync(path.join(backup,'inspect.json'),JSON.stringify(before),{mode:0o600});
fs.writeFileSync(path.join(backup,'backend.env'),fs.readFileSync(envFile),{mode:0o600});
for(const file of previousFiles)fs.writeFileSync(path.join(backup,path.basename(file)),fs.readFileSync(file),{mode:0o600});
const image=before.Config.Image;
const rollback='gridex-api-rollback:inventory-'+Date.now();
run('docker',[...docker,'tag',before.Image,rollback]);
fs.writeFileSync(path.join(backup,'rollback.json'),JSON.stringify({image,rollback,files}),{mode:0o600});
console.log('Settings unchanged. Private rollback: '+backup);
run('docker-compose',[...compose,'build','gridex-api'],options);
try{
 const db='gridex-mac-gridex-db-1';
 run('docker',[...docker,'exec',db,'pg_dump','-U','gridex','-d','gridex','-Fc','-f','/tmp/gridex-inventory-before.dump']);
 run('docker',[...docker,'cp',`${db}:/tmp/gridex-inventory-before.dump`,path.join(backup,'gridex-before.dump')]);
 run('docker',[...docker,'cp',path.join(root,'services/gridex-api/migrations/015_inventory_provisioning.sql'),`${db}:/tmp/gridex-inventory-015.sql`]);
 run('docker',[...docker,'exec',db,'psql','-v','ON_ERROR_STOP=1','-U','gridex','-d','gridex','-f','/tmp/gridex-inventory-015.sql']);
 run('docker-compose',[...compose,'up','-d','--no-deps','--no-build','gridex-api'],options);
 let healthy=false;
 for(let i=0;i<25;i++){
  const state=JSON.parse(run('docker',[...docker,'inspect','gridex-mac-gridex-api-1']))[0];
  if(state.State.Health?.Status==='healthy'){healthy=true;break;}
  await new Promise(r=>setTimeout(r,2000));
 }
 if(!healthy)throw Error('API health did not recover');
 console.log('API healthy; existing authentication restart policy preserved. Other services not recreated.');
}catch(error){
 run('docker',[...docker,'tag',rollback,image]);
 run('docker-compose',[...compose,'up','-d','--no-deps','--no-build','gridex-api'],options);
 throw error;
}
