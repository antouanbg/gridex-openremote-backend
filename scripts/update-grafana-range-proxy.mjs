#!/usr/bin/env node
// Change only the embedded Grafana launch query forwarding on the live proxy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2];
if (!['--inspect', '--apply'].includes(mode)) throw new Error('Use --inspect or --apply.');
const name = 'gridex-public-https-public-proxy-1';
const root = fileURLToPath(new URL('..', import.meta.url));
const beforeLine = 'proxy_pass http://$api_backend/internal/grafana/consume?ticket=$arg_ticket;';
const afterLine = 'proxy_pass http://$api_backend/internal/grafana/consume?$args;';
const docker = args => spawnSync('docker', args, { encoding: 'utf8', timeout: 30000 });
const inspected = docker(['inspect', name]);
if (inspected.status !== 0) throw new Error('Live proxy inspection failed.');
const live = JSON.parse(inspected.stdout)[0];
const mount = live.Mounts.find(item => item.Destination === '/etc/nginx/nginx.conf');
const certs = live.Mounts.find(item => item.Destination === '/certs')?.Source;
if (!live.State.Running || !mount?.Source?.endsWith('/nginx.conf') || !certs || !live.Config.Image.startsWith('nginx@sha256:'))
  throw new Error('Unexpected live proxy container or mounts.');
const before = fs.readFileSync(mount.Source, 'utf8');
if (before.includes(afterLine) && !before.includes(beforeLine)) {
  process.stdout.write('GRAFANA_RANGE_PROXY_ALREADY_INSTALLED\n');
  process.exit(0);
}
if (before.split(beforeLine).length !== 2 || !before.includes('# BEGIN GRIDEX EMBEDDED GRAFANA')
  || !before.includes('# END GRIDEX EMBEDDED GRAFANA'))
  throw new Error('Live Grafana route differs; refusing overwrite.');
const candidate = before.replace(beforeLine, afterLine);
// Colima shares the checkout, not macOS's per-user temporary directory.
const temp = fs.mkdtempSync(path.join(root, 'nginx-grafana-range-check.'));
try {
  const checkFile = path.join(temp, 'nginx.conf');
  fs.writeFileSync(checkFile, candidate, { mode: 0o600 });
  const check = docker(['run', '--rm', '--entrypoint', 'nginx', '-v', `${checkFile}:/etc/nginx/nginx.conf:ro`,
    '-v', `${certs}:/certs:ro`, live.Config.Image, '-t']);
  if (check.status !== 0) throw new Error(`Nginx syntax failed: ${check.stderr?.slice(-500)}`);
  if (mode === '--inspect') process.stdout.write('GRAFANA_RANGE_PROXY_READY\n');
  else {
    const backupDir = fs.mkdtempSync(path.join(os.homedir(), 'GrideX-runtime/private-backups/grafana-range-proxy-'));
    const backup = path.join(backupDir, 'nginx.conf');
    fs.writeFileSync(backup, before, { mode: 0o600 });
    fs.writeFileSync(mount.Source, candidate);
    const liveCheck = docker(['exec', name, 'nginx', '-t']);
    const reload = liveCheck.status === 0 ? docker(['exec', name, 'nginx', '-s', 'reload']) : liveCheck;
    if (reload.status !== 0) {
      fs.writeFileSync(mount.Source, before);
      docker(['exec', name, 'nginx', '-s', 'reload']);
      throw new Error(`Nginx reload failed; prior config restored. ${reload.stderr?.slice(-500)}`);
    }
    process.stdout.write(`GRAFANA_RANGE_PROXY_APPLIED backup=${backup}\n`);
  }
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
