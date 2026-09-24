// Scoped runtime deployment with private rollback. No realm/client changes.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const [envFile,manifest,backupRoot,apply]=process.argv.slice(2);
if(!envFile||!manifest||!backupRoot||apply!=='--apply')throw Error('Usage: PRIVATE_ENV RUNTIME_COMPOSE PRIVATE_BACKUPS --apply');
const originalEnv=fs.readFileSync(envFile,'utf8'),originalCompose=fs.readFileSync(manifest,'utf8');
const env=parseEnv(originalEnv);
if(!env.GRIDEX_PUBLIC_AUTH_BASE?.startsWith('https://'))throw Error('Public auth base required');
const image='gridex-openremote-manager:1.30.0-realm-issuer-v1';
const previous='openremote/manager:1.30.0@sha256:dcf6c4554a99c9afc3c0fc8d03d8d896d376b36c3f49d31e8a35c38c065355aa';
if(!originalCompose.includes('    image: '+previous))throw Error('Unexpected manager version; stop for review');
const backup=path.join(backupRoot,'manager-issuer-'+Date.now());
fs.mkdirSync(backup,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(backup,'backend.env'),originalEnv,{mode:0o600});
fs.writeFileSync(path.join(backup,'compose.mac.yml'),originalCompose,{mode:0o600});
const updatedCompose=originalCompose.replace('    image: '+previous,'    image: ${OR_MANAGER_IMAGE:-'+previous+'}')
 .replace('      OR_HOSTNAME: localhost','      OR_KEYCLOAK_ISSUER_GRIDEX: ${GRIDEX_PUBLIC_AUTH_BASE:?required}/realms/gridex\n      OR_KEYCLOAK_DISABLE_ISSUER_VALIDATION: \'false\'\n      OR_HOSTNAME: localhost');
if(updatedCompose===originalCompose)throw Error('No scoped replacement');
const updatedEnv=originalEnv.replace(/^OR_MANAGER_IMAGE=.*\n?/gm,'')+'\nOR_MANAGER_IMAGE='+image+'\n';
const composeArgs=['--env-file',envFile,'-f',manifest,'up','-d','--no-deps','--no-build','manager'];
function restart(){const r=spawnSync('docker-compose',composeArgs,{encoding:'utf8',env:{...process.env,DOCKER_CONTEXT:'colima-gridex'}});if(r.status!==0)throw Error('Manager restart failed; details withheld');}
try{
 fs.writeFileSync(envFile,updatedEnv,{mode:0o600});fs.chmodSync(envFile,0o600);
 fs.writeFileSync(manifest,updatedCompose,{mode:0o600});
 restart();
 let accepted=false;
 for(let attempt=0;attempt<24;attempt++){
  const r=spawnSync('docker',['--context','colima-gridex','exec','gridex-mac-gridex-api-1','node','--input-type=module','-e',
   'import{loadConfig}from"./src/config.mjs";import{OpenRemoteClient}from"./src/openremote-client.mjs";const c=new OpenRemoteClient(loadConfig());try{await c.queryAssets({},await c.getServiceToken())}catch{process.exit(1)}'],{encoding:'utf8'});
  if(r.status===0){accepted=true;break;}
  await new Promise(resolve=>setTimeout(resolve,5000));
 }
 if(!accepted)throw Error('Service authentication did not recover');
 console.log('Manager issuer patch applied; service query accepted. Private rollback: '+backup);
}catch(error){fs.writeFileSync(envFile,originalEnv,{mode:0o600});fs.writeFileSync(manifest,originalCompose,{mode:0o600});restart();throw error;}
