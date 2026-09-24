// Explicit activation, backed up first. Single existing operator env only.
// Изрично активиране след backup. Само единният съществуващ backend env.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
import {addManager} from './public-manager-proxy.mjs';
const [envFile,backupRoot,mode]=process.argv.slice(2);
if(!['--inspect','--apply'].includes(mode))throw Error('Usage PRIVATE_ENV PRIVATE_BACKUPS --inspect|--apply');
const env=parseEnv(fs.readFileSync(envFile,'utf8'));
const origin=new URL(env.GRIDEX_PUBLIC_AUTH_BASE).origin;
function docker(args,input){
 const r=spawnSync('docker',['--context','colima-gridex',...args],{input,encoding:'utf8',maxBuffer:8*1024*1024});
 if(r.status!==0)throw Error('Docker operation failed: '+args.slice(0,3).join(' '));
 return r.stdout;
}
const proxy='gridex-public-https-public-proxy-1';
const inspect=JSON.parse(docker(['inspect',proxy]))[0];
const mount=inspect.Mounts.find(m=>m.Destination==='/etc/nginx/nginx.conf');
if(!mount||!mount.Source.endsWith('/nginx.conf')||!inspect.State.Running)throw Error('Unexpected proxy');
const before=fs.readFileSync(mount.Source,'utf8'),next=addManager(before,origin);
const backup=fs.mkdtempSync(path.join(backupRoot,'public-manager-'));
fs.chmodSync(backup,0o700);
fs.writeFileSync(path.join(backup,'nginx.before.conf'),before,{mode:0o600});
fs.writeFileSync(path.join(backup,'nginx.candidate.conf'),next,{mode:0o600});
const inner=fs.readFileSync(new URL('./public-manager-client-inner.mjs',import.meta.url),'utf8');
function client(extra={}){return JSON.parse(docker(['exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',inner],JSON.stringify({password:env.OR_ADMIN_PASSWORD,origin,...extra})));}
const originalClient=client();
fs.writeFileSync(path.join(backup,'client.before.json'),JSON.stringify(originalClient),{mode:0o600});
console.log('Backup: '+backup);
console.log('Existing public Manager client verified; additional callback is scoped to /manager/*');
if(mode==='--apply'){
 let clientAttempted=false;
 try {
  // Preserve the bind-mounted inode, otherwise nginx reload can read the old file.
  fs.writeFileSync(mount.Source,next);
  docker(['exec',proxy,'nginx','-t']);
  clientAttempted=true;client({apply:true});
  docker(['exec',proxy,'nginx','-s','reload']);
  console.log('Proxy reloaded; browser and external acceptance still required.');
 }catch(e){
  fs.writeFileSync(mount.Source,before);
  docker(['exec',proxy,'nginx','-t']);
  docker(['exec',proxy,'nginx','-s','reload']);
  if(clientAttempted)client({restore:originalClient});
  throw e;
 }
}
