// Rebuild/recreate only the existing API service, preserving effective settings.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const [envFile,backupRoot,apply]=process.argv.slice(2);
if(apply!=='--apply')throw Error('Usage PRIVATE_ENV PRIVATE_BACKUPS --apply');
const docker=['--context','colima-gridex'];
function run(command,args,options={}){const r=spawnSync(command,args,{encoding:'utf8',maxBuffer:16*1024*1024,...options});if(r.status!==0)throw Error(command+' failed; no command output printed to protect settings');return r.stdout;}
const before=JSON.parse(run('docker',[...docker,'inspect','gridex-mac-gridex-api-1']))[0];
const files=before.Config.Labels['com.docker.compose.project.config_files'].split(',');
const compose=['--env-file',envFile,...files.flatMap(f=>['-f',f])];
const options={env:{...process.env,DOCKER_CONTEXT:'colima-gridex'}};
const planned=JSON.parse(run('docker-compose',[...compose,'config','--format','json'],options));
const currentEnv=Object.fromEntries(before.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
for(const [key,value]of Object.entries(planned.services['gridex-api'].environment)){
 if(String(value)!==currentEnv[key])throw Error('Environment drift detected for '+key+'; stop before restart');
}
const backup=fs.mkdtempSync(path.join(backupRoot,'api-inventory-'));fs.chmodSync(backup,0o700);
fs.writeFileSync(path.join(backup,'inspect.json'),JSON.stringify(before),{mode:0o600});
fs.writeFileSync(path.join(backup,'backend.env'),fs.readFileSync(envFile),{mode:0o600});
for(const file of files)fs.writeFileSync(path.join(backup,path.basename(file)),fs.readFileSync(file),{mode:0o600});
const image=before.Config.Image;
const rollback='gridex-api-rollback:inventory-'+Date.now();
run('docker',[...docker,'tag',before.Image,rollback]);
fs.writeFileSync(path.join(backup,'rollback.json'),JSON.stringify({image,rollback,files}),{mode:0o600});
console.log('Settings unchanged. Private rollback: '+backup);
run('docker-compose',[...compose,'build','gridex-api'],options);
try{
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
