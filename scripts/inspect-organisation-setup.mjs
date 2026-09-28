// Read-only inspection of the master realm permissions needed for onboarding.
// Accepts the single private backend .env; never prints secrets or tokens.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const [envFile] = process.argv.slice(2);
if (!envFile) throw new Error('Usage: node scripts/inspect-organisation-setup.mjs PRIVATE_BACKEND_ENV');
const env = parseEnv(fs.readFileSync(envFile, 'utf8'));
if (!env.OR_ADMIN_PASSWORD) throw new Error('Master administrator credential is unavailable');
const source = `
let raw=''; for await (const chunk of process.stdin) raw+=chunk;
const { password }=JSON.parse(raw), base='http://keycloak:8080/auth';
const tokenResponse=await fetch(base+'/realms/master/protocol/openid-connect/token',{
  method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password})});
if(!tokenResponse.ok)throw Error('Master authentication failed');
const {access_token}=await tokenResponse.json();
const headers={Authorization:'Bearer '+access_token};
async function json(path){const r=await fetch(base+'/admin/realms/master'+path,{headers});
  if(!r.ok)throw Error('Master lookup failed: '+r.status);return r.json();}
const manager=await json('/clients?clientId=master-realm');
const masterRoles=await json('/roles');
const relatedClients=(await json('/clients')).map(c=>c.clientId)
  .filter(id=>/master|realm|admin/i.test(id)).sort();
const roles=manager.length===1?await json('/clients/'+manager[0].id+'/roles'):[];
const masterOpenRemote=await json('/clients?clientId=openremote');
const masterOpenRemoteRoles=masterOpenRemote.length===1
  ?await json('/clients/'+masterOpenRemote[0].id+'/roles'):[];
const gridexOpenRemoteResponse=await fetch(base+'/admin/realms/gridex/clients?clientId=openremote',{headers});
if(!gridexOpenRemoteResponse.ok)throw Error('Pilot OpenRemote role lookup failed');
const gridexOpenRemote=await gridexOpenRemoteResponse.json();
if(gridexOpenRemote.length!==1)throw Error('Pilot OpenRemote client missing');
const gridexRoleResponse=await fetch(base+'/admin/realms/gridex/clients/'+gridexOpenRemote[0].id+'/roles',{headers});
if(!gridexRoleResponse.ok)throw Error('Pilot OpenRemote roles lookup failed');
const gridexRoles=await gridexRoleResponse.json();
const existing=await json('/clients?clientId=gridex-realm-setup');
console.log(JSON.stringify({masterRealmRoleNames:masterRoles.map(r=>r.name).sort(),relatedClients,
  availableRoleNames:roles.map(r=>r.name).sort(),
  masterOpenRemoteRoles:masterOpenRemoteRoles.map(r=>r.name).sort(),
  pilotOpenRemoteRoles:gridexRoles.map(r=>r.name).sort(),
  setupClientCount:existing.length,
  setupClientEnabled:existing.length===1?existing[0].enabled:null,
  serviceAccountsEnabled:existing.length===1?existing[0].serviceAccountsEnabled:null}));
`;
const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec', '-i',
  'gridex-mac-gridex-api-1', 'node', '--input-type=module', '-e', source], {
  input: JSON.stringify({ password: env.OR_ADMIN_PASSWORD }), encoding: 'utf8', timeout: 30000,
});
if (result.status !== 0) throw new Error(`Master realm inspection failed; credentials withheld: ${result.stderr?.slice(0, 800)}`);
process.stdout.write(result.stdout);
