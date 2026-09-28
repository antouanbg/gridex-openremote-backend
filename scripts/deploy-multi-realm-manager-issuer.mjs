// Manager-only rollout. No identity, database, proxy, API or device changes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const envFile = process.argv[2];
const expectedEnv = path.join(os.homedir(), 'GrideX-runtime/backend/.env');
const mode = process.argv[3];
if (path.resolve(envFile || '') !== expectedEnv || !['--check', '--apply'].includes(mode))
  throw new Error('Use the sole private backend env and --check or --apply.');
const settings = parseEnv(fs.readFileSync(envFile, 'utf8'));
if (settings.GRIDEX_PUBLIC_AUTH_BASE !== 'https://auth.gridex.tech/auth')
  throw new Error('Unexpected public auth base; inspect before deployment.');
const root = fileURLToPath(new URL('..', import.meta.url));
const expectedOverride = path.join(root, 'compose.openremote-issuer.yml');
const image = 'gridex-openremote-manager:1.30.0-organisation-access-v3';
const dockerEnv = { ...process.env, DOCKER_CONTEXT: 'colima-gridex' };
function run(command, args) {
  const result = spawnSync(command, args, { env: dockerEnv, encoding: 'utf8', timeout: 180000,
    maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}); inspect private Docker diagnostics.`);
  return result.stdout.trim();
}
function inspect() { return JSON.parse(run('docker', ['inspect', 'gridex-mac-manager-1']))[0]; }
const before = inspect();
if (before.State.Health?.Status !== 'healthy')
  throw new Error('Manager is not healthy; no change made.');
if (mode === '--check' && before.Config.Image === image) {
  if (!before.Config.Env.includes(`OR_KEYCLOAK_PUBLIC_ISSUER_BASE=${settings.GRIDEX_PUBLIC_AUTH_BASE}`)
      || !before.Config.Env.includes('OR_KEYCLOAK_DISABLE_ISSUER_VALIDATION=false'))
    throw new Error('Current Manager issuer configuration differs.');
  console.log('MULTI_REALM_ISSUER_ALREADY_ACTIVE; Manager healthy and issuer validation enabled.');
  process.exit(0);
}
if (before.Config.Image !== 'gridex-openremote-manager:1.30.0-organisation-access-v2')
  throw new Error('Unexpected Manager image or health; no change made.');
const files = before.Config.Labels['com.docker.compose.project.config_files'].split(',');
if (files.length !== 2 || files[1] !== expectedOverride || !fs.existsSync(files[0]))
  throw new Error('Unexpected Compose files; no change made.');
const composeArgs = ['--env-file', envFile, ...files.flatMap(file => ['-f', file])];
const desired = JSON.parse(run('docker-compose', [...composeArgs, 'config', '--format', 'json'])).services.manager;
if (desired.image !== image || desired.environment.OR_KEYCLOAK_PUBLIC_ISSUER_BASE !== settings.GRIDEX_PUBLIC_AUTH_BASE
    || desired.environment.OR_KEYCLOAK_DISABLE_ISSUER_VALIDATION !== 'false')
  throw new Error('Issuer validation or target image mismatch; no change made.');
const oldEnv = Object.fromEntries(before.Config.Env.map(entry => {
  const pos = entry.indexOf('='); return [entry.slice(0, pos), entry.slice(pos + 1)];
}));
for (const [key, value] of Object.entries(desired.environment)) {
  if (key !== 'OR_KEYCLOAK_PUBLIC_ISSUER_BASE' && String(value) !== oldEnv[key])
    throw new Error(`Unplanned Manager environment change: ${key}`);
}
if (oldEnv.OR_KEYCLOAK_PUBLIC_ISSUER_BASE) throw new Error('Manager already has issuer base; inspect first.');
run('docker', ['image', 'inspect', image]);
if (mode === '--check') {
  console.log('MULTI_REALM_ISSUER_READY; Manager-only image and environment diff verified.');
  process.exit(0);
}
const backupRoot = path.join(os.homedir(), 'GrideX-runtime/private-backups');
fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const backup = fs.mkdtempSync(path.join(backupRoot, 'manager-multi-realm-issuer-'));
fs.chmodSync(backup, 0o700);
const rollbackTag = `gridex-openremote-manager:rollback-${path.basename(backup)}`;
run('docker', ['tag', before.Image, rollbackTag]);
fs.writeFileSync(path.join(backup, 'runtime.json'), JSON.stringify({ previousImage: before.Image,
  previousTag: before.Config.Image, rollbackTag, files }), { mode: 0o600 });
const rollbackFile = path.join(backup, 'rollback.compose.json');
fs.writeFileSync(rollbackFile, JSON.stringify({ services: { manager: { image: rollbackTag } } }), { mode: 0o600 });
async function healthy() {
  for (let attempt = 0; attempt < 45; attempt++) {
    if (inspect().State.Health?.Status === 'healthy') return true;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  return false;
}
try {
  run('docker-compose', [...composeArgs, 'up', '-d', '--no-deps', '--no-build', 'manager']);
  if (!await healthy()) throw new Error('Manager did not become healthy.');
  const after = inspect();
  if (after.Config.Image !== image || after.Config.Env.includes('OR_KEYCLOAK_DISABLE_ISSUER_VALIDATION=true')
      || !after.Config.Env.includes(`OR_KEYCLOAK_PUBLIC_ISSUER_BASE=${settings.GRIDEX_PUBLIC_AUTH_BASE}`))
    throw new Error('Manager image or issuer configuration did not activate.');
  console.log(`MULTI_REALM_ISSUER_ACTIVE backup=${backup}`);
} catch (error) {
  run('docker-compose', [...composeArgs, '-f', rollbackFile, 'up', '-d', '--no-deps', '--no-build', 'manager']);
  if (!await healthy()) throw new Error(`Rollout failed and rollback is not healthy; private backup: ${backup}`);
  throw new Error(`Rollout failed; previous Manager image restored. Private backup: ${backup}`);
}
