// Owner-approved Keycloak-only theme rollout. Never logs secrets.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
if(process.argv[2]!=='--apply')throw Error('Explicit --apply required');
const root=fileURLToPath(new URL('..',import.meta.url));
const name='gridex-mac-keycloak-1';
function run(command,args,options={}){
 const r=spawnSync(command,args,{encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,...options});
 if(r.status!==0)throw Error(command+' failed; private output withheld');
 return r.stdout;
}
const inspect=()=>JSON.parse(run('docker',['inspect',name]))[0];
const before=inspect();
if(before.State.Health?.Status!=='healthy')throw Error('Existing Keycloak unhealthy');
const otherNames=run('docker',['ps','--format','{{.Names}}']).trim().split('\n').filter(n=>n!==name);
const others=JSON.parse(run('docker',['inspect',...otherNames]));
const compose=['--env-file',path.join(os.homedir(),'GrideX-runtime/backend/.env'),'-p','gridex-mac',
 '-f',path.join(root,'compose.mac.yml'),'-f',path.join(root,'compose.mailgun.yml')];
const planned=JSON.parse(run('docker-compose',[...compose,'config','--format','json'])).services.keycloak;
const env=Object.fromEntries(before.Config.Env.map(s=>[s.slice(0,s.indexOf('=')),s.slice(s.indexOf('=')+1)]));
for(const [key,value]of Object.entries(planned.environment))if(String(value)!==env[key])throw Error('Environment drift: '+key);
const candidate=JSON.parse(run('docker',['image','inspect',planned.image]))[0];
const backupRoot=path.join(os.homedir(),'GrideX-runtime/private-backups');
fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});
const backup=fs.mkdtempSync(path.join(backupRoot,'login-theme-'));fs.chmodSync(backup,0o700);
fs.writeFileSync(path.join(backup,'runtime.json'),JSON.stringify(before),{mode:0o600});
const fd=fs.openSync(path.join(backup,'keycloak-public.dump'),'wx',0o600);
try{run('docker',['exec','gridex-mac-postgresql-1','pg_dump','-U','postgres','-d','openremote','-n','public','-Fc'],{stdio:['ignore',fd,'pipe']});}finally{fs.closeSync(fd);}
if(fs.statSync(path.join(backup,'keycloak-public.dump')).size<1000)throw Error('Backup incomplete');
const rollback='gridex-keycloak-rollback:login-'+Date.now();run('docker',['tag',before.Image,rollback]);
const override=path.join(backup,'rollback.json');
fs.writeFileSync(override,JSON.stringify({services:{keycloak:{image:rollback}}}),{mode:0o600});
try{
 run('docker-compose',[...compose,'up','-d','--no-deps','--no-build','keycloak']);
 let healthy=false;
 for(let i=0;i<60;i++){
  const current=inspect();
  if(current.State.Health?.Status==='healthy'&&current.Image===candidate.Id){healthy=true;break;}
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 if(!healthy)throw Error('Candidate health failed');
 const after=JSON.parse(run('docker',['inspect',...otherNames]));
 if(after.some((c,i)=>c.Id!==others[i].Id||c.State.StartedAt!==others[i].State.StartedAt))throw Error('Other container changed');
 console.log('LOGIN_THEME_HEALTHY; only Keycloak recreated; backup='+backup);
}catch(error){
 run('docker-compose',[...compose,'-f',override,'up','-d','--no-deps','--no-build','keycloak']);
 throw error;
}
