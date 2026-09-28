// Read-only Compose preflight. A placeholder secret never reaches a container.
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const [envFile] = process.argv.slice(2);
if (!envFile) throw new Error('Usage: node scripts/check-organisation-compose.mjs PRIVATE_BACKEND_ENV');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    timeout: 30000, ...options });
  if (result.status !== 0) throw new Error(`${command} preflight failed; output withheld`);
  return result.stdout;
}
const before = JSON.parse(run('docker', ['--context', 'colima-gridex',
  'inspect', 'gridex-mac-gridex-api-1']))[0];
const files = before.Config.Labels['com.docker.compose.project.config_files'].split(',');
const planned = JSON.parse(run('docker-compose', ['--env-file', envFile,
  ...[...files, path.resolve('compose.organisation-setup.yml')].flatMap(file => ['-f', file]),
  'config', '--format', 'json'], { env: { ...process.env, DOCKER_CONTEXT: 'colima-gridex',
    GRIDEX_REALM_SETUP_ENABLED: 'true', GRIDEX_REALM_SETUP_CLIENT_ID: 'gridex-realm-setup',
    GRIDEX_REALM_SETUP_CLIENT_SECRET: 'preflight-placeholder',
    GRIDEX_PLATFORM_ADMIN_SUBJECTS: '1a8189f6-8af2-44b9-b96c-d54571661a3c',
  } }));
const current = Object.fromEntries(before.Config.Env.map(entry => {
  const equals = entry.indexOf('='); return [entry.slice(0, equals), entry.slice(equals + 1)];
}));
const changes = Object.entries(planned.services['gridex-api'].environment)
  .filter(([key, value]) => String(value) !== current[key]).map(([key]) => key).sort();
console.log(JSON.stringify({ plannedChangeKeys: changes,
  unexpectedChangeKeys: changes.filter(key => !new Set([
    'GRIDEX_PLATFORM_ADMIN_SUBJECTS', 'GRIDEX_REALM_SETUP_ENABLED',
    'GRIDEX_REALM_SETUP_CLIENT_ID', 'GRIDEX_REALM_SETUP_CLIENT_SECRET',
    'GRIDEX_PORTAL_ORIGIN',
  ]).has(key)),
  project: planned.name }));
