// Read-only Keycloak preflight. Credentials travel on stdin and are never logged.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const [envPath, realm] = process.argv.slice(2);
if (!envPath || !/^[a-z][a-z0-9-]{2,30}$/.test(realm || ''))
  throw Error('Usage: PRIVATE_ENV REALM');
const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const origin = new URL(env.GRIDEX_PUBLIC_AUTH_BASE).origin;
const inner = `import fs from 'node:fs';
const {password,realm,origin}=JSON.parse(fs.readFileSync(0,'utf8'));
async function get(path,options={}){const r=await fetch('http://keycloak:8080/auth'+path,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Keycloak HTTP '+r.status);return r.json();}
const token=await get('/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password})});
const headers={Authorization:'Bearer '+token.access_token};
const clients=await get('/admin/realms/'+realm+'/clients?clientId=openremote',{headers});
const client=clients.length===1?await get('/admin/realms/'+realm+'/clients/'+clients[0].id,{headers}):null;
console.log(JSON.stringify({realm,clientExists:!!client,enabled:client?.enabled===true,publicClient:client?.publicClient===true,standardFlow:client?.standardFlowEnabled===true,callback:client?.redirectUris?.some(value=>value===origin+'/manager/*'||value===origin+'/*')===true,webOrigin:client?.webOrigins?.includes(origin)===true}));`;
const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec', '-i', 'gridex-mac-gridex-api-1',
  'node', '--input-type=module', '-e', inner], {
  input: JSON.stringify({ password: env.OR_ADMIN_PASSWORD, realm, origin }), encoding: 'utf8', maxBuffer: 1024 * 1024,
});
if (result.status !== 0) throw Error('Read-only Manager client inspection failed; details withheld');
const status = JSON.parse(result.stdout);
console.log(JSON.stringify(status));
if (Object.entries(status).some(([key, value]) => key !== 'realm' && value !== true)) process.exitCode = 1;
