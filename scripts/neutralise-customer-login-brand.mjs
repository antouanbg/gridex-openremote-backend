// One operator-selected customer realm. This changes only the unauthenticated Keycloak
// heading, not the OpenRemote organisation name, access or inventory.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const [mode, backupRoot, realm] = process.argv.slice(2);
if (!['--inspect', '--apply'].includes(mode) || !backupRoot || !/^[a-z][a-z0-9-]{2,30}$/.test(realm)
    || ['gridex', 'master'].includes(realm))
  throw Error('Usage: --inspect|--apply PRIVATE_BACKUP_DIRECTORY CUSTOMER_REALM');

const inner = `
import { createHash } from 'node:crypto';
import { loadConfig } from '/app/src/config.mjs';
import { OpenRemoteRealmSetup } from '/app/src/organisation-onboarding.mjs';
const setup = new OpenRemoteRealmSetup(loadConfig());
const token = await setup.token();
const realm = process.env.GRIDEX_BRAND_REALM;
const record = await setup.kc('/' + realm, token);
const internal = await setup.or('/realm/' + realm, token);
if (record?.realm !== realm || !record.enabled || internal?.name !== realm || !internal.enabled)
  throw Error('Expected active separate customer realms');
const digest = createHash('sha256').update(JSON.stringify(record)).digest('hex');
if (process.env.GRIDEX_BRAND_MODE === 'read') console.log(JSON.stringify({ record, digest }));
else {
  if (digest !== process.env.GRIDEX_EXPECTED_DIGEST) throw Error('Realm changed since backup');
  await setup.kc('/' + realm, token, 'PUT', { ...record, displayName: 'GrideX', displayNameHtml: '' });
  const after = await setup.kc('/' + realm, token);
  if (after?.displayName !== 'GrideX' || after.displayNameHtml || after.realm !== realm || !after.enabled)
    throw Error('Generic public login title not verified');
  console.log('CUSTOMER_LOGIN_TITLE_GENERIC');
}
`;

function container(action, digest = '') {
  const args = ['--context', 'colima-gridex', 'exec', '-i', '-e', `GRIDEX_BRAND_MODE=${action}`,
    '-e', `GRIDEX_BRAND_REALM=${realm}`];
  if (digest) args.push('-e', `GRIDEX_EXPECTED_DIGEST=${digest}`);
  args.push('gridex-mac-gridex-api-1', 'node', '--input-type=module', '-');
  const result = spawnSync('docker', args, { input: inner, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  if (result.status !== 0) throw Error(`Keycloak realm ${action} failed; inspect privately`);
  return result.stdout.trim();
}

const before = JSON.parse(container('read'));
if (before.record.displayName === 'GrideX' && !before.record.displayNameHtml) {
  console.log('CUSTOMER_LOGIN_TITLE_ALREADY_GENERIC');
  process.exit(0);
}
if (mode === '--inspect') { console.log('CUSTOMER_LOGIN_TITLE_CHANGE_READY'); process.exit(0); }
const backup = fs.mkdtempSync(path.join(backupRoot, 'customer-login-brand-'));
fs.chmodSync(backup, 0o700);
fs.writeFileSync(path.join(backup, 'keycloak-realm.before.json'), JSON.stringify(before.record), { mode: 0o600 });
console.log(`${container('apply', before.digest)} backup=${backup}`);
