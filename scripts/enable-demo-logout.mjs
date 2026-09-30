// Narrow operator change: allow only /demo/ as an additional logout callback.
// Usage: node scripts/enable-demo-logout.mjs PRIVATE_ENV PRIVATE_BACKUPS --inspect|--apply
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';

const [envFile,backupRoot,mode]=process.argv.slice(2);
if(!['--inspect','--apply'].includes(mode)||!envFile||!backupRoot)throw Error('Expected private env, backup directory and --inspect|--apply');
const env=parseEnv(fs.readFileSync(envFile,'utf8'));
const origin=new URL(env.GRIDEX_PORTAL_ORIGIN);
if(origin.protocol!=='https:'||origin.origin!==env.GRIDEX_PORTAL_ORIGIN||!env.OR_ADMIN_PASSWORD)
  throw Error('Invalid private portal or admin configuration');
const source=fs.readFileSync(new URL('./demo-logout-client-inner.mjs',import.meta.url),'utf8');
function inside(config) {
  const run=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1',
    'node','--input-type=module','-e',source],{
    input:JSON.stringify({adminPassword:env.OR_ADMIN_PASSWORD,portalOrigin:origin.origin,...config}),
    encoding:'utf8',maxBuffer:8*1024*1024,
  });
  if(run.status!==0)throw Error('Private Keycloak client operation failed');
  return JSON.parse(run.stdout);
}
const before=inside({mode:'inspect'});
if(mode==='--inspect') {
  console.log(before.allowed?'DEMO_LOGOUT_ALREADY_ALLOWED':'DEMO_LOGOUT_CALLBACK_MISSING');
} else if(before.allowed) {
  console.log('DEMO_LOGOUT_ALREADY_ALLOWED');
} else {
  const backup=fs.mkdtempSync(path.join(backupRoot,'demo-logout-'));
  fs.chmodSync(backup,0o700);
  fs.writeFileSync(path.join(backup,'gridex-portal.before.json'),JSON.stringify(before.client),{mode:0o600});
  const result=inside({mode:'apply',expectedId:before.client.id,
    expectedAttribute:before.client.attributes?.['post.logout.redirect.uris']});
  if(!result.allowed)throw Error('Demo logout callback not verified');
  console.log(`DEMO_LOGOUT_CALLBACK_ALLOWED backup=${backup}`);
}
