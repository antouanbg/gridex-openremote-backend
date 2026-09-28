// Deploy the reviewed feature without touching accounts, invitations or inventory.
// All private settings are read from the existing sole backend env file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const envFile=process.argv[2];
if(!envFile || path.resolve(envFile)!==path.join(os.homedir(),'GrideX-runtime/backend/.env'))throw Error('Use the existing sole private backend env');
const original=fs.readFileSync(envFile,'utf8'),settings=parseEnv(original);
if(settings.GRIDEX_ORGANISATION_ACCESS_ENABLED==='true')throw Error('Already enabled; inspect the deployed state instead');
const root=fileURLToPath(new URL('..',import.meta.url));
const backupRoot=path.join(os.homedir(),'GrideX-runtime/private-backups');fs.mkdirSync(backupRoot,{recursive:true,mode:0o700});
const backup=fs.mkdtempSync(path.join(backupRoot,'organisation-access-'));fs.chmodSync(backup,0o700);
function run(cmd,args,input){const r=spawnSync(cmd,args,{input,encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000});if(r.status!==0){fs.writeFileSync(path.join(backup,'last-command-error.txt'),r.stderr||'',{mode:0o600});throw Error(`${cmd} failed; private diagnostics in ${backup}`);}return r.stdout;}
function inspect(name){return JSON.parse(run('docker',['inspect',name]))[0];}
const api=inspect('gridex-mac-gridex-api-1'),manager=inspect('gridex-mac-manager-1');
if(api.State.Health?.Status!=='healthy'||manager.State.Health?.Status!=='healthy')throw Error('Existing runtime is not healthy');
const files=api.Config.Labels['com.docker.compose.project.config_files'].split(',');
const managerFiles=manager.Config.Labels['com.docker.compose.project.config_files'].split(',');
const managerSource=[...managerFiles,path.join(root,'compose.openremote-issuer.yml')];
const source=files.map(f=>fs.existsSync(path.join(root,path.basename(f)))?path.join(root,path.basename(f)):f);
function compose(paths,args,extra={}){const r=spawnSync('docker-compose',['--env-file',envFile,...paths.flatMap(f=>['-f',f]),...args],{env:{...process.env,...extra},encoding:'utf8',maxBuffer:64*1024*1024,timeout:300000});if(r.status!==0){fs.writeFileSync(path.join(backup,'compose-error.txt'),r.stderr||'',{mode:0o600});throw Error(`Compose failed; private diagnostics in ${backup}`);}return r.stdout;}
const wanted=JSON.parse(compose(source,['config','--format','json'],{GRIDEX_ORGANISATION_ACCESS_ENABLED:'true'}));
const currentEnv=Object.fromEntries(api.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
const allowed=new Set(['GRIDEX_ORGANISATION_ACCESS_ENABLED','GRIDEX_MAILGUN_REGION','GRIDEX_MAILGUN_DOMAIN','GRIDEX_MAILGUN_FROM','GRIDEX_MAILGUN_API_KEY','GRIDEX_MAILGUN_BCC']);
for(const [key,value] of Object.entries(wanted.services['gridex-api'].environment))if(String(value)!==currentEnv[key]&&!allowed.has(key))throw Error(`Unplanned API environment change: ${key}`);
const wantedManager=JSON.parse(compose(managerSource,['config','--format','json'])).services.manager;
const managerEnv=Object.fromEntries(manager.Config.Env.map(v=>[v.slice(0,v.indexOf('=')),v.slice(v.indexOf('=')+1)]));
for(const [key,value] of Object.entries(wantedManager.environment))if(String(value)!==managerEnv[key])throw Error(`Unplanned Manager environment change: ${key}`);
if(wantedManager.image!=='gridex-openremote-manager:1.30.0-organisation-access-v3')throw Error('Patched Manager image missing');
if(!wanted.services['gridex-api'].environment.GRIDEX_MAILGUN_API_KEY)throw Error('Mail transport missing');
const verifyOwner = `
import {loadConfig} from './src/config.mjs';
import {OpenRemoteRealmSetup} from './src/organisation-onboarding.mjs';
import {createRepository} from './src/repository.mjs';
const config=loadConfig(), setup=new OpenRemoteRealmSetup(config), repository=createRepository(config);
try {
 if(!config.platformAdminSubjects.size)throw Error('No verified platform identity configured');
 for(const subject of config.platformAdminSubjects){
  const user=await setup.kc('/'+encodeURIComponent(config.realm)+'/users/'+encodeURIComponent(subject),await setup.token());
  const memberships=await repository.getMemberships(subject,config.realm);
  if(user.id!==subject || !user.enabled || !user.emailVerified || !memberships.some(m=>m.role==='administrator'))throw Error('Platform identity verification failed');
 }
 console.log('VERIFIED');
}finally{await repository.close();}
`;
if(run('docker',['exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',verifyOwner]).trim()!=='VERIFIED')throw Error('Verified owner allowlist mismatch');
fs.writeFileSync(path.join(backup,'backend.env'),original,{mode:0o600});
fs.writeFileSync(path.join(backup,'runtime.json'),JSON.stringify({apiImage:api.Image,managerImage:manager.Image,files,source,managerFiles,managerSource}),{mode:0o600});
const fd=fs.openSync(path.join(backup,'gridex.dump'),'wx',0o600);
const dump=spawnSync('docker',['exec','gridex-mac-gridex-db-1','pg_dump','-U','gridex','-Fc','gridex'],{stdio:['ignore',fd,'pipe'],timeout:60000});fs.closeSync(fd);
if(dump.status!==0||fs.statSync(path.join(backup,'gridex.dump')).size<1000)throw Error('Database backup failed');
function sql(query){return run('docker',['exec','-i','gridex-mac-gridex-db-1','psql','-U','gridex','-d','gridex','-v','ON_ERROR_STOP=1','-At'],query).trim();}
const counts=sql('SELECT (SELECT count(*) FROM organisations),(SELECT count(*) FROM organisation_memberships),(SELECT count(*) FROM sites);');
const apiRollback=`gridex-api-rollback:organisation-access-${Date.now()}`;
run('docker',['tag',api.Image,apiRollback]);
const rollback=path.join(backup,'rollback.compose.json');fs.writeFileSync(rollback,JSON.stringify({services:{manager:{image:manager.Config.Image},'gridex-api':{image:apiRollback}}}),{mode:0o600});
compose(source,['build','gridex-api']);
sql(fs.readFileSync(path.join(root,'services/gridex-api/migrations/013_organisation_access.sql'),'utf8'));
async function healthy(name){for(let n=0;n<45;n++){if(inspect(name).State.Health?.Status==='healthy')return;await new Promise(r=>setTimeout(r,2000));}throw Error(`${name} did not become healthy`);}
let changed=false;
try {
  changed=true;compose(managerSource,['up','-d','--no-deps','--no-build','manager']);await healthy('gridex-mac-manager-1');
  const next=original.replace(/^GRIDEX_ORGANISATION_ACCESS_ENABLED=.*\n?/m,'').replace(/\n*$/,'\n')+'GRIDEX_ORGANISATION_ACCESS_ENABLED=true\n';
  const temporary=envFile+'.organisation-access.tmp';fs.writeFileSync(temporary,next,{mode:0o600,flag:'wx'});fs.renameSync(temporary,envFile);
  compose(source,['up','-d','--no-deps','--no-build','gridex-api']);await healthy('gridex-mac-gridex-api-1');
  if(sql('SELECT (SELECT count(*) FROM organisations),(SELECT count(*) FROM organisation_memberships),(SELECT count(*) FROM sites);')!==counts)throw Error('Business-record counts changed unexpectedly');
  if(!inspect('gridex-mac-gridex-api-1').Config.Env.includes('GRIDEX_ORGANISATION_ACCESS_ENABLED=true'))throw Error('Feature flag did not activate');
  console.log(`ORGANISATION_ACCESS_DEPLOYED backup=${backup}; no organisation status changed and no mail sent`);
} catch(error) {
  if(changed && sql('SELECT count(*) FROM organisation_access_operations;')==='0'){
    fs.writeFileSync(envFile,original,{mode:0o600});compose([...managerFiles,rollback],['up','-d','--no-deps','--no-build','manager']);compose([...files,rollback],['up','-d','--no-deps','--no-build','gridex-api']);
  }
  throw error;
}
