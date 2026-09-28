// One-time activation of the already implemented UI onboarding flow.
// Uses the sole private backend .env and backs up the current API/database.
// Never prints passwords, client secrets, tokens or full Docker configuration.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const [envFile, apply] = process.argv.slice(2);
if (!envFile || apply !== '--apply')
  throw new Error('Usage: node scripts/activate-organisation-invitations.mjs PRIVATE_BACKEND_ENV --apply');
const originalEnv = fs.readFileSync(envFile, 'utf8');
const env = parseEnv(originalEnv);
if ((fs.statSync(envFile).mode & 0o777) !== 0o600)
  throw new Error('Private backend .env must have mode 0600');
if (!env.OR_ADMIN_PASSWORD || env.GRIDEX_PORTAL_ORIGIN !== 'https://gridex.tech'
    || env.GRIDEX_PUBLIC_AUTH_BASE !== 'https://auth.gridex.tech/auth')
  throw new Error('Master administrator and exact public portal/auth settings are required');
if (env.GRIDEX_REALM_SETUP_CLIENT_SECRET || env.GRIDEX_REALM_SETUP_ENABLED === 'true')
  throw new Error('Realm setup is already configured; inspect the live deployment instead');

const docker = ['--context', 'colima-gridex'];
const backupRoot = path.join(os.homedir(), 'GrideX-runtime', 'private-backups');
fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
const backup = fs.mkdtempSync(path.join(backupRoot, 'organisation-invitations-'));
fs.chmodSync(backup, 0o700);
const envBackup = path.join(backup, 'backend.env');
fs.writeFileSync(envBackup, originalEnv, { mode: 0o600, flag: 'wx' });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 300000,
    ...options,
  });
  if (result.status !== 0) throw new Error(`${command} failed (${result.status ?? 'signal'}); inspect private backup ${backup}`);
  return result.stdout;
}
function compose(files, args, overrides = {}) {
  return run('docker-compose', ['--env-file', envFile,
    ...files.flatMap(file => ['-f', file]), ...args], {
    env: { ...process.env, DOCKER_CONTEXT: 'colima-gridex', ...overrides },
  });
}
function setValue(source, key, value) {
  if (!/^[A-Z0-9_]+$/.test(key) || /[\r\n]/.test(value)) throw new Error('Invalid environment entry');
  const lines = source.split(/\r?\n/);
  const indices = lines.flatMap((line, index) => line.startsWith(`${key}=`) ? [index] : []);
  if (indices.length > 1) throw new Error(`Duplicate environment key ${key}`);
  if (indices.length) lines[indices[0]] = `${key}=${value}`;
  else lines.splice(lines.at(-1) === '' ? lines.length - 1 : lines.length, 0, `${key}=${value}`);
  return `${lines.join('\n').replace(/\n*$/, '')}\n`;
}
function writePrivateEnv(content) {
  const temp = `${envFile}.org-invitations-${process.pid}.tmp`;
  fs.writeFileSync(temp, content, { mode: 0o600, flag: 'wx' });
  fs.renameSync(temp, envFile);
}

const owner = JSON.parse(run('node', ['scripts/inspect-platform-owner.mjs', envFile, 'antouan.bg@gmail.com']));
const before = JSON.parse(run('docker', [...docker, 'inspect', 'gridex-mac-gridex-api-1']))[0];
if (before.State.Health?.Status !== 'healthy') throw new Error('Current API is not healthy');
const files = before.Config.Labels['com.docker.compose.project.config_files'].split(',');
const overlay = path.resolve('compose.organisation-setup.yml');
if (files.includes(overlay)) throw new Error('Organisation overlay is already deployed');
const currentEnv = Object.fromEntries(before.Config.Env.map(entry => {
  const equals = entry.indexOf('='); return [entry.slice(0, equals), entry.slice(equals + 1)];
}));
const rollbackTag = `gridex-api-rollback:org-invitations-${Date.now()}`;
run('docker', [...docker, 'tag', before.Image, rollbackTag]);
fs.writeFileSync(path.join(backup, 'rollback.json'), JSON.stringify({
  image: before.Config.Image, rollbackTag, files, ownerSubject: owner.subject,
}), { mode: 0o600, flag: 'wx' });

const dump = path.join(backup, 'gridex.dump');
const fd = fs.openSync(dump, 'wx', 0o600);
let result;
try {
  result = spawnSync('docker', [...docker, 'exec', 'gridex-mac-gridex-db-1',
    'pg_dump', '-U', 'gridex', '-d', 'gridex', '-Fc'], {
    stdio: ['ignore', fd, 'pipe'], timeout: 120000,
  });
} finally { fs.closeSync(fd); }
if (result.status !== 0 || fs.statSync(dump).size === 0) throw new Error(`Database backup failed; ${backup}`);
const listing = spawnSync('docker', [...docker, 'exec', '-i', 'gridex-mac-gridex-db-1',
  'pg_restore', '--list'], { input: fs.readFileSync(dump), encoding: 'utf8', timeout: 120000 });
if (listing.status !== 0 || !listing.stdout.includes('TABLE'))
  throw new Error(`Database backup validation failed; ${backup}`);

let setupClient;
let wroteEnv = false;
let restartAttempted = false;
try {
  console.log('Private database and backend configuration backup verified.');
  compose(files, ['build', 'gridex-api']);
  console.log('Updated API image built.');
  const source = fs.readFileSync(new URL('./prepare-organisation-setup-inner.mjs', import.meta.url), 'utf8');
  const setupResult = spawnSync('docker', [...docker, 'exec', '-i', 'gridex-mac-gridex-api-1',
    'node', '--input-type=module', '-e', source], {
    input: JSON.stringify({ password: env.OR_ADMIN_PASSWORD }), encoding: 'utf8',
    timeout: 300000, maxBuffer: 1024 * 1024,
  });
  if (setupResult.status !== 0) {
    const diagnostic = (setupResult.stderr || '').split('\n').find(line =>
      /^(Error:|TypeError:|ReferenceError:|SyntaxError:)/.test(line)) || 'no diagnostic';
    throw new Error(`Setup client creation failed: ${diagnostic}`);
  }
  setupClient = JSON.parse(setupResult.stdout);
  if (!setupClient.clientUuid || !setupClient.secret) throw new Error('Setup client verification incomplete');
  console.log('Dedicated master setup client and OpenRemote master access verified.');

  const added = {
    GRIDEX_PLATFORM_ADMIN_SUBJECTS: owner.subject,
    GRIDEX_REALM_SETUP_ENABLED: 'true',
    GRIDEX_REALM_SETUP_CLIENT_ID: setupClient.clientId,
    GRIDEX_REALM_SETUP_CLIENT_SECRET: setupClient.secret,
  };
  const planned = JSON.parse(compose([...files, overlay], ['config', '--format', 'json'], added));
  const allowedChanges = new Set([...Object.keys(added), 'GRIDEX_PORTAL_ORIGIN']);
  const changes = Object.entries(planned.services['gridex-api'].environment)
    .filter(([key, value]) => String(value) !== currentEnv[key])
    .map(([key]) => key);
  const unplanned = changes.filter(key => !allowedChanges.has(key));
  if (unplanned.length) throw new Error(`Other API settings would change: ${unplanned.join(', ')}`);
  for (const [key, value] of Object.entries(added))
    if (String(planned.services['gridex-api'].environment[key]) !== value)
      throw new Error(`New setting ${key} did not reach Compose`);

  const sql = fs.readFileSync(new URL('../services/gridex-api/migrations/012_organisation_onboarding.sql', import.meta.url));
  run('docker', [...docker, 'exec', '-i', 'gridex-mac-gridex-db-1',
    'psql', '-U', 'gridex', '-d', 'gridex', '-v', 'ON_ERROR_STOP=1'], { input: sql });
  const migrated = run('docker', [...docker, 'exec', 'gridex-mac-gridex-db-1',
    'psql', '-U', 'gridex', '-d', 'gridex', '-Atqc',
    "SELECT to_regclass('public.organisation_onboarding_invitations') IS NOT NULL"]);
  if (migrated.trim() !== 't') throw new Error('Migration 012 verification failed');
  console.log('Migration 012 verified.');

  let next = originalEnv;
  for (const [key, value] of Object.entries(added)) next = setValue(next, key, value);
  writePrivateEnv(next); wroteEnv = true;
  restartAttempted = true;
  compose([...files, overlay], ['up', '-d', '--no-deps', '--no-build', 'gridex-api']);
  let healthy = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = JSON.parse(run('docker', [...docker, 'inspect', 'gridex-mac-gridex-api-1']))[0];
    if (state.State.Health?.Status === 'healthy') { healthy = true; break; }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!healthy) throw new Error('Updated API did not become healthy');
  const effective = JSON.parse(run('docker', [...docker, 'inspect', 'gridex-mac-gridex-api-1']))[0];
  const effectiveEnv = Object.fromEntries(effective.Config.Env.map(entry => {
    const equals = entry.indexOf('='); return [entry.slice(0, equals), entry.slice(equals + 1)];
  }));
  for (const [key, value] of Object.entries(added))
    if (effectiveEnv[key] !== value) throw new Error(`Effective API setting ${key} was not applied`);
  if (effectiveEnv.GRIDEX_PORTAL_ORIGIN !== env.GRIDEX_PORTAL_ORIGIN)
    throw new Error('Public portal origin was not applied');
  console.log(`ORGANISATION_INVITATIONS_ACTIVE backup=${backup} owner_subject=${owner.subject}`);
} catch (error) {
  const rollbackErrors = [];
  try { if (wroteEnv) writePrivateEnv(originalEnv); } catch { rollbackErrors.push('private env restore'); }
  try { run('docker', [...docker, 'tag', rollbackTag, before.Config.Image]); }
  catch { rollbackErrors.push('API image restore'); }
  try { if (restartAttempted) compose(files, ['up', '-d', '--no-deps', '--no-build', 'gridex-api']); }
  catch { rollbackErrors.push('API container restore'); }
  try {
    if (setupClient?.clientUuid) {
      const source = fs.readFileSync(new URL('./remove-organisation-setup-inner.mjs', import.meta.url), 'utf8');
      run('docker', [...docker, 'exec', '-i', 'gridex-mac-gridex-api-1',
        'node', '--input-type=module', '-e', source], {
        input: JSON.stringify({ password: env.OR_ADMIN_PASSWORD, clientId: setupClient.clientUuid }),
      });
    }
  } catch { rollbackErrors.push('temporary setup client removal'); }
  throw new Error(`Activation stopped: ${error.message}. Backup: ${backup}. Rollback issues: ${rollbackErrors.join(', ') || 'none'}`);
}
