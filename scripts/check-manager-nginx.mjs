// Validate the production proxy template in the pinned image without touching
// the running proxy. Nginx reads its config twice, so use a disposable file.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const live = JSON.parse(spawnSync('docker', ['--context', 'colima-gridex', 'inspect',
  'gridex-public-https-public-proxy-1'], { encoding: 'utf8' }).stdout)[0];
const certs = live.Mounts.find(mount => mount.Destination === '/certs')?.Source;
if (!certs || !live.Config.Image.startsWith('nginx@sha256:')) throw Error('Unexpected proxy image or certificates');
const temporary = fs.mkdtempSync(path.join(root, 'nginx-check.'));
try {
  const template = fs.readFileSync(path.join(root, 'deploy/public-https/nginx.conf.template'), 'utf8');
  const config = template.replaceAll('${API_HOST}', 'api.gridex.tech').replaceAll('${AUTH_HOST}', 'auth.gridex.tech');
  const file = path.join(temporary, 'nginx.conf');
  fs.writeFileSync(file, config, { mode: 0o600 });
  const result = spawnSync('docker', ['--context', 'colima-gridex', 'run', '--rm',
    '--entrypoint', 'nginx', '-v', `${file}:/etc/nginx/nginx.conf:ro`, '-v', `${certs}:/certs:ro`,
    live.Config.Image, '-t'], { encoding: 'utf8', timeout: 30000 });
  if (result.status !== 0) throw Error(`Disposable Nginx syntax test failed: ${result.stderr?.slice(-1200) || ''}`);
  console.log('MANAGER_NGINX_TEMPLATE_VALID');
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
