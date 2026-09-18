// Execute inside the API container. Settings arrive privately on stdin.
// stdout is a rollback snapshot: capture privately, never commit it.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const settings = JSON.parse(fs.readFileSync(0, 'utf8'));
const publicBase = new URL(settings.authBaseUrl);
assert.equal(publicBase.protocol, 'https:');
assert.equal(publicBase.pathname, '/auth');
const origin = new URL(settings.portalOrigin);
assert.equal(origin.protocol, 'https:');
assert.equal(origin.origin, settings.portalOrigin);
const kc = 'http://keycloak:8080/auth';
async function request(path, options = {}) {
  const response = await fetch(`${kc}${path}`, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Keycloak HTTP ${response.status} at ${path.split('?')[0]}`);
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}
const token = await request('/realms/master/protocol/openid-connect/token', {
  method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli',
    username: 'admin', password: settings.adminPassword }),
});
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const realm = await request('/admin/realms/gridex', { headers });
const clients = await request('/admin/realms/gridex/clients?clientId=gridex-portal', { headers });
assert.equal(clients.length, 1);
const clientPath = `/admin/realms/gridex/clients/${clients[0].id}`;
const client = await request(clientPath, { headers });
assert.equal(client.publicClient, true);
const backup = { realmAttributes: realm.attributes || {}, clientPath, client };
// Snapshot is emitted before any mutation so the caller can retain rollback data.
console.log(JSON.stringify(backup));
if (!settings.apply) process.exit(0);
const callbacks = ['/', '/en/', '/silent-check-sso.html'].map(path => `${origin.origin}${path}`);
try {
  await request('/admin/realms/gridex', { headers, method: 'PUT', body: JSON.stringify({
    attributes: { ...realm.attributes, frontendUrl: publicBase.href },
  }) });
  await request(clientPath, { headers, method: 'PUT', body: JSON.stringify({
    ...client, redirectUris: [...new Set([...client.redirectUris, ...callbacks])],
    webOrigins: [...new Set([...client.webOrigins, origin.origin])],
    attributes: { ...client.attributes, 'pkce.code.challenge.method': 'S256',
      'post.logout.redirect.uris': [...new Set([
        ...(client.attributes?.['post.logout.redirect.uris'] || '').split('##').filter(Boolean),
        `${origin.origin}/`, `${origin.origin}/en/`,
        'http://127.0.0.1:4173/', 'http://127.0.0.1:4173/en/',
      ])].join('##') },
  }) });
  const discovery = await request('/realms/gridex/.well-known/openid-configuration');
  assert.equal(discovery.issuer, `${publicBase.href}/realms/gridex`);
  for (const field of ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'end_session_endpoint']) {
    assert.ok(discovery[field].startsWith(`${publicBase.href}/realms/gridex/`));
  }
  console.error('Public realm discovery verified; master realm and service permissions preserved.');
} catch (error) {
  await request('/admin/realms/gridex', { headers, method: 'PUT', body: JSON.stringify({ attributes: backup.realmAttributes }) });
  await request(clientPath, { headers, method: 'PUT', body: JSON.stringify(client) });
  throw error;
}
