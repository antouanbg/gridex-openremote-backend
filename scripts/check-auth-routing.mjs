// Read-only regression gate. Local self-signed TLS is allowed only for localhost.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const config = parseEnv(fs.readFileSync(process.argv[2], 'utf8'));
const local = config.GRIDEX_ADMIN_AUTH_BASE;
const publicBase = config.GRIDEX_PUBLIC_AUTH_BASE;
if (!local || !publicBase || new URL(local).hostname !== 'localhost') throw new Error('Invalid auth configuration');
let failed = false;
function request(url, insecure = false) {
  const r = spawnSync('curl', ['--silent', '--show-error', '--max-time', '10', ...(insecure ? ['--insecure'] : []), '--write-out', '\n%{http_code}', url], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error('Connection or TLS failed');
  const split = r.stdout.lastIndexOf('\n');
  return { status: Number(r.stdout.slice(split + 1)), body: r.stdout.slice(0, split) };
}
function check(name, task) {
  try { if (!task()) throw new Error('Unexpected response'); console.log('PASS '+name); }
  catch { console.error('FAIL '+name); failed = true; }
}
check('local master issuer', () => JSON.parse(request(local+'/realms/master/.well-known/openid-configuration', true).body).issuer === local+'/realms/master');
check('admin console local authServerUrl', () => {
  const r=request(local+'/admin/master/console/', true);
  return r.status===200 && r.body.includes('"authServerUrl": "'+local+'"');
});
check('fresh master login stays local', () => {
  const u=new URL(local+'/realms/master/protocol/openid-connect/auth');
  u.search=new URLSearchParams({client_id:'security-admin-console',redirect_uri:local+'/admin/master/console/',response_type:'code',scope:'openid',code_challenge:'a'.repeat(43),code_challenge_method:'S256'}).toString();
  const r=request(u.href,true);
  return r.status===200 && r.body.includes('name="password"') && r.body.includes('action="'+local+'/realms/master/login-actions/');
});
check('public gridex issuer via normal DNS and trusted TLS', () => JSON.parse(request(publicBase+'/realms/gridex/.well-known/openid-configuration').body).issuer===publicBase+'/realms/gridex');
for (const suffix of ['/admin/', '/realms/master/.well-known/openid-configuration', '/health', '/metrics']) {
  check('public denied '+suffix, () => request(publicBase+suffix).status===404);
}
process.exitCode=failed?1:0;
