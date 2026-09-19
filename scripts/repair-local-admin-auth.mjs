// Run on the backend host. Secrets travel only over stdin, never argv/logs.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const [envFile, backupDirectory] = process.argv.slice(2);
if (!envFile || !backupDirectory) throw new Error('Usage: node script PRIVATE_ENV PRIVATE_BACKUP_DIRECTORY');
const config = parseEnv(fs.readFileSync(envFile, 'utf8'));
const local = config.GRIDEX_ADMIN_AUTH_BASE;
const publicBase = config.GRIDEX_PUBLIC_AUTH_BASE;
if (!local || !publicBase || !config.OR_ADMIN_PASSWORD) throw new Error('Required configuration missing');
const url = new URL(local);
if (url.protocol !== 'https:' || url.hostname !== 'localhost') throw new Error('Admin URL must remain HTTPS localhost');
const source = `
let input=''; for await (const chunk of process.stdin) input+=chunk;
const cfg=JSON.parse(input), base='http://keycloak:8080/auth';
async function json(url, options={}) { const r=await fetch(url,options); if(!r.ok) throw new Error('Keycloak HTTP '+r.status); return r.json(); }
const token=await json(base+'/realms/master/protocol/openid-connect/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',username:'admin',password:cfg.password})});
const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
const master=await json(base+'/admin/realms/master',{headers});
const gridexBefore=await json(base+'/realms/gridex/.well-known/openid-configuration');
if(gridexBefore.issuer!==cfg.publicBase+'/realms/gridex') throw new Error('Public issuer precondition failed');
// Return rollback metadata before mutation; parent persists it even on failure.
console.log(JSON.stringify({realm:'master',previousAttributes:master.attributes||{},local:cfg.local}));
const response=await fetch(base+'/admin/realms/master',{method:'PUT',headers,body:JSON.stringify({attributes:{...master.attributes,frontendUrl:cfg.local}})});
if(!response.ok) throw new Error('Realm update HTTP '+response.status);
const discovery=await json(base+'/realms/master/.well-known/openid-configuration');
const gridexAfter=await json(base+'/realms/gridex/.well-known/openid-configuration');
if(discovery.issuer!==cfg.local+'/realms/master'||gridexAfter.issuer!==gridexBefore.issuer) throw new Error('Issuer verification failed; use rollback snapshot');
`;
fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec', '-i', 'gridex-mac-gridex-api-1', 'node', '--input-type=module', '-e', source], {
  input: JSON.stringify({ password: config.OR_ADMIN_PASSWORD, local, publicBase }), encoding: 'utf8', maxBuffer: 1024 * 1024,
});
if (result.stdout.trim()) fs.writeFileSync(path.join(backupDirectory, `master-local-auth-${Date.now()}.json`), result.stdout, { mode: 0o600, flag: 'wx' });
if (result.status !== 0) { console.error('Repair failed; inspect private rollback metadata. No credentials printed.'); process.exitCode = 1; }
else console.log('Master realm local issuer verified; public gridex issuer preserved. Private rollback saved.');
