// One-time migration. Conflicts abort; original inputs are preserved privately.
import fs from 'node:fs';
import path from 'node:path';
import { parseEnv } from 'node:util';
const [directory, bcc] = process.argv.slice(2);
if (!path.isAbsolute(directory || '') || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(bcc || '')) throw new Error('Usage: script /absolute/private/backend support@example.com');
const main = path.join(directory, '.env');
const files = ['.env', 'public-oidc.env', 'mailgun.env'].filter(f => fs.existsSync(path.join(directory, f)));
const merged = {};
for (const file of files) for (const [key, value] of Object.entries(parseEnv(fs.readFileSync(path.join(directory,file), 'utf8')))) {
  if (key in merged && merged[key] !== value) throw new Error(`Conflicting setting: ${key}`);
  merged[key] = value;
}
merged.GRIDEX_MAILGUN_BCC = bcc;
merged.GRIDEX_ENROLLMENT_ENABLED = 'true';
const backup = path.join(directory, 'config-rollback-' + new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backup, {mode:0o700});
for (const file of files) { fs.copyFileSync(path.join(directory,file), path.join(backup,file)); fs.chmodSync(path.join(backup,file),0o600); }
const serialized = Object.entries(merged).map(([k,v]) => {
  if (/[\r\n']/.test(v)) throw new Error(`Unsupported multiline or quote in setting: ${k}`);
  return `${k}='${v}'`;
}).join('\n')+'\n';
fs.writeFileSync(main+'.new',serialized,{mode:0o600}); fs.renameSync(main+'.new',main);
// Old files are retained in backup, not silently deleted or still loaded.
for (const file of files.filter(f => f !== '.env')) fs.renameSync(path.join(directory,file),path.join(backup,file+'.retired'));
console.log('Consolidated private .env; rollback: '+backup);
