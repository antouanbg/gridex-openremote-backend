// Run inside staging API with private settings on stdin. No emails are sent.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const settings = JSON.parse(fs.readFileSync(0, 'utf8'));
const kc = 'http://keycloak:8080/auth';
async function request(path, options = {}) {
  const r = await fetch(`${kc}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Keycloak HTTP ${r.status}`);
  const text = await r.text(); return text ? JSON.parse(text) : null;
}
if (!settings.GRIDEX_ENROLLMENT_CLIENT_SECRET) throw new Error('Private enrollment secret missing');
const token = await request('/realms/master/protocol/openid-connect/token', { method: 'POST',
  body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password', username: 'admin', password: settings.OR_ADMIN_PASSWORD }) });
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const base = '/admin/realms/gridex';
const realm = await request(base, { headers });
const policy = { registrationAllowed: false, registrationEmailAsUsername: true,
  loginWithEmailAllowed: true, duplicateEmailsAllowed: false, verifyEmail: true,
  resetPasswordAllowed: true, editUsernameAllowed: false, bruteForceProtected: true };
await request(base, { headers, method: 'PUT', body: JSON.stringify({ ...realm, ...policy }) });
const clients = `${base}/clients`;
let [client] = await request(`${clients}?clientId=gridex-enrollment`, { headers });
if (!client) {
  await request(clients, { headers, method: 'POST', body: JSON.stringify({ clientId: 'gridex-enrollment',
    enabled: true, protocol: 'openid-connect', publicClient: false, serviceAccountsEnabled: true,
    standardFlowEnabled: false, directAccessGrantsEnabled: false,
    secret: settings.GRIDEX_ENROLLMENT_CLIENT_SECRET }) });
  [client] = await request(`${clients}?clientId=gridex-enrollment`, { headers });
}
assert.equal(client.publicClient, false);
assert.equal(client.standardFlowEnabled, false);
assert.equal(client.directAccessGrantsEnabled, false);
const user = await request(`${clients}/${client.id}/service-account-user`, { headers });
const [management] = await request(`${clients}?clientId=realm-management`, { headers });
const roles = await request(`${clients}/${management.id}/roles`, { headers });
const needed = ['query-users', 'manage-users'].map(name => {
  const role = roles.find(r => r.name === name); assert.ok(role); return role;
});
await request(`${base}/users/${user.id}/role-mappings/clients/${management.id}`, {
  headers, method: 'POST', body: JSON.stringify(needed) });
const verified = await request(base, { headers });
for (const [key, value] of Object.entries(policy)) assert.equal(verified[key], value);
const serviceToken = await request('/realms/gridex/protocol/openid-connect/token', { method: 'POST',
  body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'gridex-enrollment',
    client_secret: settings.GRIDEX_ENROLLMENT_CLIENT_SECRET }) });
await request(`${base}/users?email=enrollment-probe%40example.invalid&exact=true`, {
  headers: { Authorization: `Bearer ${serviceToken.access_token}` } });
console.log('PASS gridex: invite-only, email login/verification, password recovery, brute-force protection. Master realm unchanged.');
console.log('PASS dedicated confidential enrollment client user-query. No email sent; enrollment remains disabled.');
console.log(`SMTP host/from configured: ${Boolean(verified.smtpServer?.host && verified.smtpServer?.from)}`);
