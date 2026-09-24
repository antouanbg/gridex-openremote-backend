// Read-only identity check. Never prints tokens or credentials.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const [envFile, email] = process.argv.slice(2);
if (!envFile || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || ''))
  throw new Error('Usage: node scripts/inspect-platform-owner.mjs PRIVATE_BACKEND_ENV OWNER_EMAIL');
const settings = parseEnv(fs.readFileSync(envFile, 'utf8'));
if (!settings.OR_ADMIN_PASSWORD) throw new Error('Master-admin password is unavailable');
const source = `
let raw=''; for await (const chunk of process.stdin) raw+=chunk;
const input=JSON.parse(raw), base='http://keycloak:8080/auth';
const tokenResponse=await fetch(base+'/realms/master/protocol/openid-connect/token',{
  method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:input.password})});
if(!tokenResponse.ok)throw Error('Master authentication failed');
const {access_token}=await tokenResponse.json();
const response=await fetch(base+'/admin/realms/gridex/users?email='+encodeURIComponent(input.email)+'&exact=true',{
  headers:{Authorization:'Bearer '+access_token}});
if(!response.ok)throw Error('Owner lookup failed');
const matches=(await response.json()).filter(user=>user.email?.toLowerCase()===input.email.toLowerCase());
if(matches.length!==1||!matches[0].enabled||!matches[0].emailVerified||!matches[0].id)
  throw Error('Expected exactly one enabled, verified owner in gridex');
console.log(JSON.stringify({subject:matches[0].id,realm:'gridex',emailVerified:true}));
`;
const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec', '-i',
  'gridex-mac-gridex-api-1', 'node', '--input-type=module', '-e', source], {
  input: JSON.stringify({ password: settings.OR_ADMIN_PASSWORD, email }),
  encoding: 'utf8', timeout: 30000,
});
if (result.status !== 0) throw new Error('Owner identity lookup failed; credentials withheld');
const identity = JSON.parse(result.stdout);
if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(identity.subject))
  throw new Error('Owner subject is not a UUID');
console.log(JSON.stringify(identity));
