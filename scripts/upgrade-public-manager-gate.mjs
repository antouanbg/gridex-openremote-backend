// Replace only the marked Manager block in the bind-mounted live proxy config.
// Preserve the public OIDC realms, API, Docusaurus and all other server blocks.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';

const [mode, envFile] = process.argv.slice(2);
if (!['--inspect', '--apply'].includes(mode) || envFile !== path.join(os.homedir(), 'GrideX-runtime/backend/.env'))
  throw Error('Usage: --inspect|--apply EXISTING_PRIVATE_BACKEND_ENV');
const origin = new URL(parseEnv(fs.readFileSync(envFile, 'utf8')).GRIDEX_PUBLIC_AUTH_BASE);
if (origin.protocol !== 'https:' || origin.pathname !== '/auth') throw Error('Unexpected auth origin');
const authHost = origin.hostname;
const root = fileURLToPath(new URL('..', import.meta.url));
function docker(args) {
  const result = spawnSync('docker', ['--context', 'colima-gridex', ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw Error(`Docker ${args[0]} failed`);
  return result.stdout;
}
const proxy = 'gridex-public-https-public-proxy-1';
const active = JSON.parse(docker(['inspect', proxy]))[0];
const mount = active.Mounts.find(item => item.Destination === '/etc/nginx/nginx.conf');
if (!active.State.Running || !mount?.Source?.endsWith('/nginx.conf')) throw Error('Unexpected live proxy');
const before = fs.readFileSync(mount.Source, 'utf8');
const template = fs.readFileSync(path.join(root, 'deploy/public-https/nginx.conf.template'), 'utf8')
  .replaceAll('${API_HOST}', 'api.gridex.tech').replaceAll('${AUTH_HOST}', authHost);
function block(content) {
  const start = content.indexOf('        # BEGIN GRIDEX PUBLIC MANAGER');
  const endMark = '        # END GRIDEX PUBLIC MANAGER';
  const end = content.indexOf(endMark, start);
  if (start < 0 || end < 0 || content.indexOf(endMark, end + 1) >= 0
      || content.indexOf('        # BEGIN GRIDEX PUBLIC MANAGER', start + 1) >= 0)
    throw Error('Manager markers must appear exactly once');
  return { start, end: end + endMark.length, content: content.slice(start, end + endMark.length) };
}
const oldBlock = block(before), newBlock = block(template);
const candidate = before.slice(0, oldBlock.start) + newBlock.content + before.slice(oldBlock.end);
if (candidate === before) { console.log('MANAGER_GATE_ALREADY_INSTALLED'); process.exit(0); }
if (!candidate.includes('# BEGIN GRIDEX PUBLIC DOCS') || !candidate.includes('location /auth/realms/novacom/'))
  throw Error('Candidate lost docs or customer auth routes');
if (candidate.replace(newBlock.content, oldBlock.content) !== before) throw Error('Candidate changes other routes');
if (mode === '--inspect') { console.log('MANAGER_GATE_UPGRADE_READY'); process.exit(0); }
const backupRoot = path.join(os.homedir(), 'GrideX-runtime/private-backups');
fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const backup = fs.mkdtempSync(path.join(backupRoot, 'public-manager-gate-'));
fs.chmodSync(backup, 0o700);
fs.writeFileSync(path.join(backup, 'nginx.before.conf'), before, { mode: 0o600 });
try {
  // Bind mounts follow the inode, so overwrite contents instead of rename.
  fs.writeFileSync(mount.Source, candidate);
  docker(['exec', proxy, 'nginx', '-t']);
  docker(['exec', proxy, 'nginx', '-s', 'reload']);
  console.log(`MANAGER_GATE_INSTALLED backup=${backup}`);
} catch (error) {
  fs.writeFileSync(mount.Source, before);
  docker(['exec', proxy, 'nginx', '-t']);
  docker(['exec', proxy, 'nginx', '-s', 'reload']);
  throw error;
}
