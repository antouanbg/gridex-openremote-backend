// Apply migration 016 and rebuild only the existing API service, preserving its settings.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const [envFile, backupRoot, apply] = process.argv.slice(2);
if (apply !== '--apply' || !envFile || !backupRoot) {
  throw Error('Usage: node scripts/deploy-invitation-login.mjs PRIVATE_ENV PRIVATE_BACKUPS --apply');
}

const docker = ['--context', 'colima-gridex'];
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, ...options });
  if (result.status !== 0) throw Error(`${command} failed; command output omitted to protect settings`);
  return result.stdout;
}

const before = JSON.parse(run('docker', [...docker, 'inspect', 'gridex-mac-gridex-api-1']))[0];
if (before.State.Health?.Status !== 'healthy') throw Error('Current API is not healthy');
const previousFiles = before.Config.Labels['com.docker.compose.project.config_files'].split(',');
const files = previousFiles.map(file => path.join(root, path.basename(file)));
if (files.some(file => !fs.existsSync(file))) throw Error('A current Compose manifest is missing');
const compose = ['--env-file', envFile, '-p', 'gridex-mac', ...files.flatMap(file => ['-f', file])];
const options = { env: { ...process.env, DOCKER_CONTEXT: 'colima-gridex' } };
const planned = JSON.parse(run('docker-compose', [...compose, 'config', '--format', 'json'], options));
const currentEnv = Object.fromEntries(before.Config.Env.map(value => [value.slice(0, value.indexOf('=')), value.slice(value.indexOf('=') + 1)]));
for (const [key, value] of Object.entries(planned.services['gridex-api'].environment)) {
  if (String(value) !== currentEnv[key]) throw Error(`Environment drift detected for ${key}; stop before restart`);
}

const backup = fs.mkdtempSync(path.join(backupRoot, 'api-invitation-login-'));
fs.chmodSync(backup, 0o700);
fs.writeFileSync(path.join(backup, 'inspect.json'), JSON.stringify(before), { mode: 0o600 });
fs.writeFileSync(path.join(backup, 'backend.env'), fs.readFileSync(envFile), { mode: 0o600 });
for (const file of previousFiles) {
  fs.writeFileSync(path.join(backup, path.basename(file)), fs.readFileSync(file), { mode: 0o600 });
}
const rollbackImage = `gridex-api-rollback:invitation-login-${Date.now()}`;
run('docker', [...docker, 'tag', before.Image, rollbackImage]);
fs.writeFileSync(path.join(backup, 'rollback.json'), JSON.stringify({ image: before.Config.Image, rollbackImage, files }), { mode: 0o600 });
console.log(`Settings unchanged. Private rollback: ${backup}`);

const db = 'gridex-mac-gridex-db-1';
const dump = '/tmp/gridex-before-invitation-login.dump';
run('docker', [...docker, 'exec', db, 'pg_dump', '-U', 'gridex', '-d', 'gridex', '-Fc', '-f', dump]);
run('docker', [...docker, 'cp', `${db}:${dump}`, path.join(backup, 'gridex-before.dump')]);
if (fs.statSync(path.join(backup, 'gridex-before.dump')).size === 0) throw Error('Database backup is empty');

run('docker-compose', [...compose, 'build', 'gridex-api'], options);
try {
  run('docker', [...docker, 'cp', path.join(root, 'services/gridex-api/migrations/016_invitation_login_activity.sql'), `${db}:/tmp/gridex-invitation-login-016.sql`]);
  run('docker', [...docker, 'exec', db, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'gridex', '-d', 'gridex', '-f', '/tmp/gridex-invitation-login-016.sql']);
  run('docker-compose', [...compose, 'up', '-d', '--no-deps', '--no-build', 'gridex-api'], options);
  let healthy = false;
  for (let i = 0; i < 30; i++) {
    const state = JSON.parse(run('docker', [...docker, 'inspect', 'gridex-mac-gridex-api-1']))[0];
    if (state.State.Health?.Status === 'healthy') { healthy = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!healthy) throw Error('API health did not recover');
  console.log('Migration 016 applied; API healthy. Other services not recreated.');
} catch (error) {
  run('docker', [...docker, 'tag', rollbackImage, before.Config.Image]);
  run('docker-compose', [...compose, 'up', '-d', '--no-deps', '--no-build', 'gridex-api'], options);
  throw error;
}
