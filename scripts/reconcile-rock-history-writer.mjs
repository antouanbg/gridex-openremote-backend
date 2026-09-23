// Restricted ROCK history-writer link repair; source of truth stays OpenRemote.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';

const [envFile, backupRoot, mode] = process.argv.slice(2);
if (!envFile || !backupRoot || !['--inspect','--apply'].includes(mode)) {
  throw Error('Usage: PRIVATE_ENV PRIVATE_BACKUPS --inspect|--apply');
}
const env = parseEnv(fs.readFileSync(envFile, 'utf8'));
const bindings = JSON.parse(env.GRIDEX_HISTORY_BINDINGS || '[]');
const record = fs.mkdtempSync(path.join(backupRoot, 'rock-history-writer-'));
fs.chmodSync(record, 0o700);
const source = fs.readFileSync(new URL('./reconcile-rock-history-writer-inner.mjs', import.meta.url), 'utf8');
function run(apply) {
  const result = spawnSync('docker', ['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source], {
    input:JSON.stringify({adminPassword:env.OR_ADMIN_PASSWORD,writerId:env.GRIDEX_HISTORY_WRITER_CLIENT_ID,
      writerSecret:env.GRIDEX_HISTORY_WRITER_CLIENT_SECRET,bindings,apply}), encoding:'utf8', maxBuffer:16*1024*1024,
  });
  fs.writeFileSync(path.join(record, apply?'after.json':'before.json'), result.stdout, {mode:0o600});
  if (result.status !== 0) {
    fs.writeFileSync(path.join(record,'failure.log'), result.stderr, {mode:0o600});
    throw Error(`OpenRemote writer reconciliation failed; private diagnostics: ${record}`);
  }
  return JSON.parse(result.stdout);
}
const before = run(false);
console.log(`History writer: ${before.missing.length} of six system asset links missing. Private snapshot: ${record}`);
if (mode === '--apply') {
  const dump = spawnSync('docker',['--context','colima-gridex','exec','gridex-mac-postgresql-1','pg_dump','-U','postgres','-d','openremote','-Fc'],{maxBuffer:256*1024*1024});
  if (dump.status !== 0 || dump.stdout.subarray(0,5).toString() !== 'PGDMP') throw Error('OpenRemote backup failed; no links changed');
  const list = spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-postgresql-1','pg_restore','--list'],{input:dump.stdout,maxBuffer:16*1024*1024});
  if (list.status !== 0) throw Error('OpenRemote backup validation failed; no links changed');
  fs.writeFileSync(path.join(record,'openremote.dump'),dump.stdout,{mode:0o600});
  const after = run(true);
  console.log(`Linked ${after.missing.length} missing assets through OpenRemote; restricted writer sees exactly six system assets. Private backup: ${record}`);
}
