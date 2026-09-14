// Run inside the staging API container with private settings on stdin.
// Never print tokens, credentials or full HTTP response bodies.
import fs from 'node:fs';
const settings = JSON.parse(fs.readFileSync(0, 'utf8'));
const kc = 'http://keycloak:8080/auth';
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${new URL(url).pathname}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
const token = await request(`${kc}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli',
    username: 'admin', password: settings.OR_ADMIN_PASSWORD }),
});
const headers = { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' };
const bootstrapId = `gridex-bootstrap-${crypto.randomUUID()}`;
const masterClients = `${kc}/admin/realms/master/clients`;
await request(masterClients, { headers, method: 'POST', body: JSON.stringify({
  clientId: bootstrapId, publicClient: true, protocol: 'openid-connect',
  standardFlowEnabled: false, directAccessGrantsEnabled: true,
  protocolMappers: [{ name: 'manager-audience', protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper', config: { 'included.client.audience': 'openremote',
      'access.token.claim': 'true', 'id.token.claim': 'false' } }],
}) });
const [bootstrap] = await request(`${masterClients}?clientId=${bootstrapId}`, { headers });
try {
const managerToken = await request(`${kc}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: bootstrapId,
    username: 'admin', password: settings.OR_ADMIN_PASSWORD }),
});
const managerHeaders = { ...headers, Authorization: `Bearer ${managerToken.access_token}` };
const realms = await request('http://manager:8080/api/master/realm', { headers: managerHeaders });
if (!realms.some(r => r.name === 'gridex')) {
  await request('http://manager:8080/api/master/realm', { headers: managerHeaders, method: 'POST',
    body: JSON.stringify({ name: 'gridex', displayName: 'GrideX staging', enabled: true, registrationAllowed: false }) });
  console.log('Created gridex realm through OpenRemote');
} else console.log('Existing gridex realm preserved');
} finally {
  await request(`${masterClients}/${bootstrap.id}`, { headers, method: 'DELETE' });
  console.log('Removed temporary bootstrap client');
}
const admin = `${kc}/admin/realms/gridex`;
async function createClient(body) {
  const found = await request(`${admin}/clients?clientId=${body.clientId}`, { headers });
  if (found.length) {
    if (body.clientId === 'gridex-portal') {
      await request(`${admin}/clients/${found[0].id}`, { headers, method: 'PUT',
        body: JSON.stringify({ ...found[0], redirectUris: body.redirectUris, webOrigins: body.webOrigins }) });
      console.log('Updated local portal callback origin');
    } else console.log(`Existing client preserved: ${body.clientId}`);
    return found[0];
  }
  await request(`${admin}/clients`, { headers, method: 'POST', body: JSON.stringify(body) });
  console.log(`Created client: ${body.clientId}`);
  return (await request(`${admin}/clients?clientId=${body.clientId}`, { headers }))[0];
}
await createClient({ clientId: 'gridex-portal', protocol: 'openid-connect', enabled: true,
  publicClient: true, standardFlowEnabled: true, directAccessGrantsEnabled: false,
  // Exact local callbacks: login/logout, English entry and silent SSO.
  // Never allow arbitrary redirect hosts or ports.
  redirectUris: ['https://localhost:8443/*', 'http://127.0.0.1:4173/',
    'http://127.0.0.1:4173/en/', 'http://127.0.0.1:4173/silent-check-sso.html'],
  webOrigins: ['https://localhost:8443', 'http://127.0.0.1:4173'],
  attributes: { 'pkce.code.challenge.method': 'S256' },
  protocolMappers: [{ name: 'gridex-api-audience', protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper', config: {
      'included.client.audience': 'gridex-portal', 'access.token.claim': 'true', 'id.token.claim': 'false' } }],
});
await createClient({ clientId: 'gridex-api', protocol: 'openid-connect', enabled: true,
  publicClient: false, serviceAccountsEnabled: true, standardFlowEnabled: false,
  directAccessGrantsEnabled: false, secret: settings.OPENREMOTE_SERVICE_CLIENT_SECRET });
const [orClient] = await request(`${admin}/clients?clientId=openremote`, { headers });
const availableRoles = await request(`${admin}/clients/${orClient.id}/roles`, { headers });
const readAssets = availableRoles.find(r => r.name === 'read:assets');
if (!readAssets) throw new Error('Expected read:assets role missing');
const [serviceClient] = await request(`${admin}/clients?clientId=gridex-api`, { headers });
const serviceUser = await request(`${admin}/clients/${serviceClient.id}/service-account-user`, { headers });
await request(`${admin}/users/${serviceUser.id}/role-mappings/clients/${orClient.id}`, {
  headers, method: 'POST', body: JSON.stringify([readAssets]),
});
const mappers = await request(`${admin}/clients/${serviceClient.id}/protocol-mappers/models`, { headers });
if (!mappers.some(m => m.name === 'openremote-audience')) {
  await request(`${admin}/clients/${serviceClient.id}/protocol-mappers/models`, {
    headers, method: 'POST', body: JSON.stringify({ name: 'openremote-audience',
      protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
      config: { 'included.client.audience': 'openremote', 'access.token.claim': 'true', 'id.token.claim': 'false' } }),
  });
}
const serviceToken = await request(`${kc}/realms/gridex/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'gridex-api',
    client_secret: settings.OPENREMOTE_SERVICE_CLIENT_SECRET }),
});
const assets = await request('http://manager:8080/api/gridex/asset/query', {
  method: 'POST', headers: { ...headers, Authorization: `Bearer ${serviceToken.access_token}` },
  body: JSON.stringify({}),
});
console.log(`Service-account asset read passed; ${assets.length} assets. No write role granted.`);
console.log('Browser login and tenant acceptance remain pending');
