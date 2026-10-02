// Activate the approved realm-local Asset service in the API only.
// Human-role migration is intentionally a separate, explicit operation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const backup = process.argv[2];
const expected = path.join(os.homedir(), 'GrideX-runtime', 'private-backups');
if (!backup || path.dirname(path.resolve(backup)) !== expected
    || !['gridex.dump', 'openremote.dump', 'runtime.json'].every(name =>
      fs.existsSync(path.join(backup, name)) && fs.statSync(path.join(backup, name)).size > 1000))
  throw new Error('Verified private member-access backup directory required.');
const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = path.join(os.homedir(), 'GrideX-runtime', 'backend', '.env');
const original = fs.readFileSync(envFile, 'utf8');
if (/^GRIDEX_MEMBER_ACCESS_ENABLED=true$/m.test(original))
  throw new Error('Member access is already enabled; inspect live state.');
const files = ['compose.mac.yml', 'compose.mailgun.yml', 'compose.device-vault.yml',
  'compose.heartbeats.yml', 'compose.organisation-setup.yml', 'compose.member-access.yml'];
const composeArgs = ['-p', 'gridex-mac', '--env-file', envFile,
  ...files.flatMap(file => ['-f', path.join(root, file)])];
function run(cmd, args, env = process.env) {
  const result = spawnSync(cmd, args, { env, encoding:'utf8', timeout:180000,
    maxBuffer:8*1024*1024 });
  if (result.status !== 0) throw new Error(`${cmd} failed: ${result.stderr?.slice(0, 600)}`);
  return result.stdout;
}
const current = JSON.parse(run('docker', ['inspect', 'gridex-mac-gridex-api-1']))[0];
if (current.State.Health?.Status !== 'healthy') throw new Error('Current API is unhealthy.');
const oldImage = current.Image;
const nextEnv = original.replace(/^GRIDEX_MEMBER_ACCESS_ENABLED=.*\n?/m, '')
  .replace(/\n*$/, '\n') + 'GRIDEX_MEMBER_ACCESS_ENABLED=true\n';
const configured = JSON.parse(run('docker-compose', [...composeArgs, 'config', '--format', 'json'],
  { ...process.env, GRIDEX_MEMBER_ACCESS_ENABLED:'true' }));
if (configured.services?.['gridex-api']?.environment?.GRIDEX_MEMBER_ACCESS_ENABLED !== 'true')
  throw new Error('Compose member access flag was not verified.');
const previousEnv = Object.fromEntries(current.Config.Env.map(entry => {
  const i = entry.indexOf('='); return [entry.slice(0, i), entry.slice(i+1)];
}));
for (const [key, value] of Object.entries(configured.services['gridex-api'].environment))
  if (key !== 'GRIDEX_MEMBER_ACCESS_ENABLED' && String(value) !== previousEnv[key])
    throw new Error(`Unexpected API environment change: ${key}`);
fs.writeFileSync(path.join(backup, 'backend.env.before'), original, { mode:0o600, flag:'wx' });
fs.writeFileSync(path.join(backup, 'api-image.before'), oldImage, { mode:0o600, flag:'wx' });
const rollbackTag = `gridex-api-rollback:before-member-access-${Date.now()}`;
run('docker', ['tag', oldImage, rollbackTag]);
fs.writeFileSync(path.join(backup, 'api-rollback-tag'), rollbackTag, { mode:0o600, flag:'wx' });
const temporary = `${envFile}.member-access.tmp`;
try {
  fs.writeFileSync(temporary, nextEnv, { mode:0o600, flag:'wx' });
  fs.renameSync(temporary, envFile);
  run('docker-compose', [...composeArgs, 'up', '-d', '--no-deps', '--no-build', 'gridex-api']);
  let healthy = false;
  for (let i=0; i<35; i++) {
    const api = JSON.parse(run('docker', ['inspect', 'gridex-mac-gridex-api-1']))[0];
    if (api.State.Health?.Status === 'healthy' &&
        api.Config.Env.includes('GRIDEX_MEMBER_ACCESS_ENABLED=true') && api.Image !== oldImage) {
      healthy = true; break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!healthy) throw new Error('New API did not become healthy with the approved flag.');
  console.log(`MEMBER_ACCESS_API_ACTIVE backup=${backup}; human roles unchanged`);
} catch (error) {
  fs.writeFileSync(envFile, original, { mode:0o600 });
  run('docker', ['tag', oldImage, 'gridex-mac-gridex-api:latest']);
  run('docker-compose', [...composeArgs, 'up', '-d', '--no-deps', '--no-build',
    '--force-recreate', 'gridex-api']);
  throw error;
} finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
