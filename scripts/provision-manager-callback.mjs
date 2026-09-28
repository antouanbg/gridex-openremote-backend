// One-time approved customer Manager callback; preserves every other client field.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const [mode, realm] = process.argv.slice(2);
if (!['--inspect', '--apply'].includes(mode) || realm !== 'novacom')
  throw Error('Usage: --inspect|--apply novacom');
const inner = `import {loadConfig} from './src/config.mjs';
import {OpenRemoteRealmSetup} from './src/organisation-onboarding.mjs';
const setup=new OpenRemoteRealmSetup(loadConfig());
const token=await setup.token();
const clients=await setup.kc('/novacom/clients?clientId=openremote',token);
if(!Array.isArray(clients)||clients.length!==1)throw Error('Expected one OpenRemote client');
const client=await setup.kc('/novacom/clients/'+encodeURIComponent(clients[0].id),token);
if(client.clientId!=='openremote'||!client.publicClient||!client.standardFlowEnabled)throw Error('Unexpected browser client');
if(process.env.MANAGER_CALLBACK_APPLY==='true')await setup.ensureManagerClient('novacom',token,clients[0]);
const actual=process.env.MANAGER_CALLBACK_APPLY==='true'
  ?await setup.kc('/novacom/clients/'+encodeURIComponent(clients[0].id),token):client;
console.log(JSON.stringify({before:client,after:{callback:actual.redirectUris?.includes(setup.config.managerPublicOrigin+'/manager/*')===true,
  webOrigin:actual.webOrigins?.includes(setup.config.managerPublicOrigin)===true}}));`;
function call(apply) {
  const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec',
    ...(apply ? ['-e', 'MANAGER_CALLBACK_APPLY=true'] : []),
    'gridex-mac-gridex-api-1', 'node', '--input-type=module', '-e', inner],
  { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 30000 });
  if (result.status !== 0) throw Error('Keycloak Manager client check/update failed; details withheld');
  return JSON.parse(result.stdout);
}
const payload = call(false);
if (mode === '--apply') {
  const backupRoot = path.join(os.homedir(), 'GrideX-runtime/private-backups');
  fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
  const backup = fs.mkdtempSync(path.join(backupRoot, 'manager-client-'));
  fs.chmodSync(backup, 0o700);
  fs.writeFileSync(path.join(backup, 'client-before.json'), JSON.stringify(payload.before), { mode: 0o600 });
  const updated = call(true);
  if (!updated.after.callback || !updated.after.webOrigin) throw Error('Callback update not verified');
  console.log(`MANAGER_CLIENT_READY backup=${backup}`);
} else {
  console.log(JSON.stringify({ realm, callback: payload.after.callback, webOrigin: payload.after.webOrigin }));
}
