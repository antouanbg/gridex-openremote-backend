// Controlled API-only rollout. Run from the reviewed branch with the existing
// private backend env path. Never recreates Keycloak, Manager or the proxy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const envFile = process.argv[2];
const expected = path.join(os.homedir(), 'GrideX-runtime/backend/.env');
if (envFile !== expected) throw Error(`Use the existing private backend env: ${expected}`);
const root = fileURLToPath(new URL('..', import.meta.url));
const backupRoot = path.join(os.homedir(), 'GrideX-runtime/private-backups');
fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const backup = fs.mkdtempSync(path.join(backupRoot, 'manager-launch-'));
fs.chmodSync(backup, 0o700);

function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, {
    encoding: 'utf8', timeout: 300000, maxBuffer: 64 * 1024 * 1024, ...options,
  });
  if (result.status !== 0) {
    fs.writeFileSync(path.join(backup, 'last-error.txt'), result.stderr || '', { mode: 0o600 });
    throw Error(`${binary} ${args[0]} failed; private diagnostics: ${backup}`);
  }
  return result.stdout;
}
const docker = (args, options) => run('docker', ['--context', 'colima-gridex', ...args], options);
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const apiName = 'gridex-mac-gridex-api-1';
const api = inspect(apiName);
if (api.State.Health?.Status !== 'healthy') throw Error('Current API is not healthy');
const currentFiles = api.Config.Labels['com.docker.compose.project.config_files'].split(',');
const files = currentFiles.map(file => path.join(root, path.basename(file)));
if (files.some(file => !fs.existsSync(file))) throw Error('Reviewed Compose overlay missing');
const composeArgs = ['-p', 'gridex-mac', '--env-file', envFile, ...files.flatMap(file => ['-f', file])];
const compose = (args, more = []) => run('docker-compose', [...composeArgs, ...more, ...args]);
const plan = JSON.parse(compose(['config', '--format', 'json']));
const service = plan.services['gridex-api'];
if (service.build?.context !== path.join(root, 'services/gridex-api')) throw Error('Unexpected API build context');
const liveEnv = Object.fromEntries(api.Config.Env.map(value => {
  const index = value.indexOf('='); return [value.slice(0, index), value.slice(index + 1)];
}));
const drift = Object.entries(service.environment).filter(([key, value]) => String(value) !== liveEnv[key]).map(([key]) => key);
if (drift.length > 1 || (drift.length === 1 && drift[0] !== 'GRIDEX_PUBLIC_AUTH_BASE'))
  throw Error(`Unplanned API environment drift: ${drift.join(', ') || 'none'}`);
if (!String(service.environment.GRIDEX_PUBLIC_AUTH_BASE).startsWith('https://'))
  throw Error('Public auth origin is not HTTPS');
const counts = () => docker(['exec', 'gridex-mac-gridex-db-1', 'psql', '-U', 'gridex', '-d', 'gridex', '-Atc',
  'SELECT (SELECT count(*) FROM organisations),(SELECT count(*) FROM organisation_memberships),(SELECT count(*) FROM sites);']).trim();
const beforeCounts = counts();
const migrationExists = docker(['exec', 'gridex-mac-gridex-db-1', 'psql', '-U', 'gridex', '-d', 'gridex', '-Atc',
  "SELECT to_regclass('public.manager_launch_sessions') IS NOT NULL;"]).trim() === 't';
const dump = fs.openSync(path.join(backup, 'gridex.dump'), 'wx', 0o600);
try {
  const result = spawnSync('docker', ['--context', 'colima-gridex', 'exec', 'gridex-mac-gridex-db-1',
    'pg_dump', '-U', 'gridex', '-Fc', 'gridex'], { stdio: ['ignore', dump, 'pipe'], timeout: 120000 });
  if (result.status !== 0) throw Error('Private database backup failed');
} finally { fs.closeSync(dump); }
if (fs.statSync(path.join(backup, 'gridex.dump')).size < 1000) throw Error('Database backup is empty');
fs.writeFileSync(path.join(backup, 'previous.json'), JSON.stringify({ image: api.Image, files: currentFiles }), { mode: 0o600 });
const rollbackImage = `gridex-api-rollback:manager-launch-${Date.now()}`;
docker(['tag', api.Image, rollbackImage]);
const rollbackFile = path.join(backup, 'rollback.compose.json');
fs.writeFileSync(rollbackFile, JSON.stringify({ services: { 'gridex-api': { image: rollbackImage } } }), { mode: 0o600 });
compose(['build', 'gridex-api']);
if (!migrationExists) {
  const sql = fs.readFileSync(path.join(root, 'services/gridex-api/migrations/014_manager_launch.sql'), 'utf8');
  docker(['exec', '-i', 'gridex-mac-gridex-db-1', 'psql', '-U', 'gridex', '-d', 'gridex', '-v', 'ON_ERROR_STOP=1'], { input: sql });
}
let changed = false;
try {
  changed = true;
  compose(['up', '-d', '--no-deps', '--no-build', 'gridex-api']);
  let healthy = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    if (inspect(apiName).State.Health?.Status === 'healthy') { healthy = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!healthy || counts() !== beforeCounts) throw Error('API health or business-record invariant failed');
  console.log(`MANAGER_API_DEPLOYED backup=${backup}`);
} catch (error) {
  if (changed) {
    run('docker-compose', [...composeArgs, '-f', rollbackFile, 'up', '-d', '--no-deps', '--no-build', 'gridex-api']);
  }
  throw error;
}
