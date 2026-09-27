// Scoped repair for the first customer's action-email/OIDC route only.
// Ограничена поправка само за action-email/OIDC маршрута на първия клиент.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { addCustomerRealms } from './public-customer-realms-proxy.mjs';

const mode = process.argv[2];
if (!['--inspect', '--apply'].includes(mode)) throw Error('Usage: --inspect|--apply');
const proxy = 'gridex-public-https-public-proxy-1';

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`${command} ${args.slice(0, 3).join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout;
}
function status(host, route) {
  return Number(run('curl', ['--silent', '--show-error', '--noproxy', '*', '--max-time', '10',
    '--resolve', `${host}:14443:127.0.0.1`, '--output', '/dev/null', '--write-out', '%{http_code}',
    `https://${host}:14443${route}`]).trim());
}
async function checkRoutes(expectedCustomer) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const results = {
    gridex: status('auth.gridex.tech', '/auth/realms/gridex/.well-known/openid-configuration'),
    novacom: status('auth.gridex.tech', '/auth/realms/novacom/.well-known/openid-configuration'),
    master: status('auth.gridex.tech', '/auth/realms/master/.well-known/openid-configuration'),
    admin: status('auth.gridex.tech', '/auth/admin/'),
    api: status('api.gridex.tech', '/api/v1/me'),
    docs: status('doc.gridex.tech', '/organisations-and-access/'),
    };
    if (results.gridex !== 200 || results.master !== 404 || results.admin !== 404
        || results.api !== 401 || results.docs !== 200) {
      console.log(JSON.stringify(results));
      throw Error('Public route regression');
    }
    if (results.novacom === expectedCustomer) {
      console.log(JSON.stringify(results));
      return;
    }
    if (attempt === 9) {
      console.log(JSON.stringify(results));
      throw Error('Customer realm route did not become active');
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

const inspect = JSON.parse(run('docker', ['inspect', proxy]))[0];
const mount = inspect.Mounts.find(item => item.Destination === '/etc/nginx/nginx.conf');
if (!inspect.State.Running || !mount || !mount.Source.endsWith('/nginx.conf')
    || !mount.Source.includes('/GrideX-runtime/public-https-test/'))
  throw Error('Unexpected proxy or config mount');
const before = fs.readFileSync(mount.Source, 'utf8');
const after = addCustomerRealms(before);
console.log('Exact novacom route candidate validated; master/admin remain denied.');
if (mode === '--inspect') {
  await checkRoutes(404);
  process.exit(0);
}

const backupRoot = path.resolve(path.dirname(mount.Source), '../private-backups');
const backup = fs.mkdtempSync(path.join(backupRoot, 'customer-realm-proxy-'));
fs.chmodSync(backup, 0o700);
fs.writeFileSync(path.join(backup, 'nginx.before.conf'), before, { mode: 0o600 });
fs.writeFileSync(path.join(backup, 'nginx.candidate.conf'), after, { mode: 0o600 });
if (fs.readFileSync(mount.Source, 'utf8') !== before) throw Error('Proxy config changed during inspection');

try {
  // Keep the bind-mounted inode intact; only this reviewed location changes.
  fs.writeFileSync(mount.Source, after);
  run('docker', ['exec', proxy, 'nginx', '-t']);
  run('docker', ['exec', proxy, 'nginx', '-s', 'reload']);
  await checkRoutes(200);
  console.log(`GRIDEX_CUSTOMER_REALM_PROXY_ACTIVE backup=${backup}`);
} catch (error) {
  fs.writeFileSync(mount.Source, before);
  run('docker', ['exec', proxy, 'nginx', '-t']);
  run('docker', ['exec', proxy, 'nginx', '-s', 'reload']);
  throw error;
}
