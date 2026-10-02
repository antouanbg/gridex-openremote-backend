// Production checkpoint before the approved human-role migration.
// Dumps both databases without printing credentials or modifying services.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.join(os.homedir(), 'GrideX-runtime', 'private-backups');
fs.mkdirSync(root, { recursive:true, mode:0o700 });
const dir = fs.mkdtempSync(path.join(root, 'member-access-'));
fs.chmodSync(dir, 0o700);
function docker(args, output) {
  const fd = output ? fs.openSync(path.join(dir, output), 'wx', 0o600) : null;
  try {
    const result = spawnSync('docker', args, {
      stdio: ['ignore', fd ?? 'pipe', 'pipe'], encoding:fd ? undefined : 'utf8', timeout:120000,
    });
    if (result.status !== 0) throw new Error(`Docker backup command failed for ${args[1]}`);
    if (output && fs.statSync(path.join(dir, output)).size < 1000)
      throw new Error(`Backup is empty: ${output}`);
    return result.stdout;
  } finally { if (fd !== null) fs.closeSync(fd); }
}
try {
  const names = ['gridex-mac-gridex-api-1', 'gridex-mac-keycloak-1',
    'gridex-mac-gridex-db-1', 'gridex-mac-postgresql-1'];
  const inspected = JSON.parse(docker(['inspect', ...names]));
  if (inspected.length !== names.length || inspected.some(item => item.State?.Health?.Status !== 'healthy'))
    throw new Error('A required production service is not healthy; backup was not accepted.');
  const checkpoint = inspected.map(item => ({ name:item.Name, image:item.Image,
    configFiles:item.Config?.Labels?.['com.docker.compose.project.config_files'] || null }));
  fs.writeFileSync(path.join(dir, 'runtime.json'), JSON.stringify(checkpoint, null, 2), { mode:0o600 });
  docker(['exec', 'gridex-mac-gridex-db-1', 'pg_dump', '-U', 'gridex', '-d', 'gridex', '-Fc'], 'gridex.dump');
  docker(['exec', 'gridex-mac-postgresql-1', 'pg_dump', '-U', 'postgres', '-d', 'openremote', '-Fc'], 'openremote.dump');
  console.log(`MEMBER_ACCESS_BACKUP_READY=${dir}`);
} catch (error) {
  console.error(`Member access backup incomplete; inspect private directory ${dir}`);
  throw error;
}
