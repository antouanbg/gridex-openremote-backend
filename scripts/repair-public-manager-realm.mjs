// Upgrade the existing public Manager block without touching auth action links.
// Updates the mounted inode, validates nginx and rolls back on failure.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const mode = process.argv[2];
const backupRoot = process.argv[3];
const envFile = process.argv[4];
if (!['--inspect', '--apply'].includes(mode) || !backupRoot || !envFile) throw Error('Usage: --inspect|--apply PRIVATE_BACKUP_DIRECTORY PRIVATE_ENV');
const origin = new URL(parseEnv(fs.readFileSync(envFile, 'utf8')).GRIDEX_PUBLIC_AUTH_BASE).origin;
if (!origin.startsWith('https://')) throw Error('Public auth origin must use HTTPS');

function docker(args) {
  const result = spawnSync('docker', ['--context', 'colima-gridex', ...args], { encoding: 'utf8', maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw Error(`Docker ${args[0]} failed`);
  return result.stdout;
}

const proxy = 'gridex-public-https-public-proxy-1';
const inspect = JSON.parse(docker(['inspect', proxy]))[0];
const mount = inspect?.Mounts?.find(item => item.Destination === '/etc/nginx/nginx.conf');
if (!inspect?.State?.Running || !mount?.Source?.endsWith('/nginx.conf')) throw Error('Unexpected public proxy mount');
const before = fs.readFileSync(mount.Source, 'utf8');
const legacy = `        location /manager/ { limit_except GET { deny all; }
            proxy_pass http://$manager_backend; }`;
const relativeGuard = `        location = /manager/ {
            if ($arg_realm != gridex) { return 302 /manager/?realm=gridex; }
            limit_except GET { deny all; }
            proxy_pass http://$manager_backend;
        }
${legacy}`;
const guarded = `        location = /manager/ {
            if ($arg_realm != gridex) { return 302 ${origin}/manager/?realm=gridex; }
            limit_except GET { deny all; }
            proxy_pass http://$manager_backend;
        }
${legacy}`;
if (before.split(legacy).length !== 2 || !before.includes('# BEGIN GRIDEX PUBLIC MANAGER')) throw Error('Unexpected Manager proxy layout');
let candidate = before.includes(relativeGuard) ? before.replace(relativeGuard, guarded)
  : before.includes(guarded) ? before : before.replace(legacy, guarded);
const relativeRedirect = 'location = /manager { return 302 /manager/?realm=gridex; }';
const absoluteRedirect = `location = /manager { return 302 ${origin}/manager/?realm=gridex; }`;
if (!before.includes(relativeRedirect) && !before.includes(absoluteRedirect))
  throw Error('Unexpected Manager redirect layout');
candidate = candidate.replace(relativeRedirect, absoluteRedirect);
if (candidate === before) { console.log('PUBLIC_MANAGER_REALM_ALREADY_GUARDED'); process.exit(0); }
const previousBlock = before.includes(relativeGuard) ? relativeGuard : before.includes(guarded) ? guarded : legacy;
const previousRedirect = before.includes(relativeRedirect) ? relativeRedirect : absoluteRedirect;
if (candidate.replace(guarded, previousBlock).replace(absoluteRedirect, previousRedirect) !== before) {
  throw Error('Candidate changed routes beyond Manager entry');
}
if (mode === '--inspect') { console.log('PUBLIC_MANAGER_REALM_GUARD_READY'); process.exit(0); }

const backup = fs.mkdtempSync(path.join(backupRoot, 'public-manager-realm-'));
fs.chmodSync(backup, 0o700);
fs.writeFileSync(path.join(backup, 'nginx.before.conf'), before, { mode: 0o600 });
try {
  // This config is bind-mounted: replacing the inode would leave nginx on the old file.
  fs.writeFileSync(mount.Source, candidate);
  docker(['exec', proxy, 'nginx', '-t']);
  docker(['exec', proxy, 'nginx', '-s', 'reload']);
  console.log(`PUBLIC_MANAGER_REALM_GUARDED backup=${backup}`);
} catch (error) {
  fs.writeFileSync(mount.Source, before);
  docker(['exec', proxy, 'nginx', '-t']);
  docker(['exec', proxy, 'nginx', '-s', 'reload']);
  throw error;
}
