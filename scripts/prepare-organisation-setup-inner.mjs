// Runs inside the API container. The master password arrives only on stdin.
// Creates a dedicated client limited to creating and administering realms it
// creates, plus the OpenRemote master realm API roles required by provisioning.
import { randomBytes } from 'node:crypto';

let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const input = JSON.parse(raw);
const base = 'http://keycloak:8080/auth';
const clientId = 'gridex-realm-setup';
const tokenResponse = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
  method: 'POST',
  body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli',
    username: 'admin', password: input.password }),
  signal: AbortSignal.timeout(10000),
});
if (!tokenResponse.ok) throw new Error('Master administrator authentication failed');
const { access_token: masterToken } = await tokenResponse.json();
const headers = { Authorization: `Bearer ${masterToken}`, 'Content-Type': 'application/json' };
async function admin(path, method = 'GET', body) {
  const response = await fetch(`${base}/admin/realms/master${path}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(`Master setup ${path.split('?')[0]} failed (${response.status})`);
  if (response.status === 201 || response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const existing = await admin(`/clients?clientId=${clientId}`);
if (!Array.isArray(existing) || existing.length) {
  throw new Error('Dedicated setup client already exists; inspect before changing it');
}
const secret = randomBytes(32).toString('base64url');
await admin('/clients', 'POST', { clientId, protocol: 'openid-connect',
  publicClient: false, serviceAccountsEnabled: true, enabled: true,
  standardFlowEnabled: false, directAccessGrantsEnabled: false,
  secret,
  protocolMappers: [{ name: 'openremote-audience', protocol: 'openid-connect',
    protocolMapper: 'oidc-audience-mapper', config: {
      'included.client.audience': 'openremote',
      'access.token.claim': 'true', 'id.token.claim': 'false',
    } }],
});
const [client] = await admin(`/clients?clientId=${clientId}`);
if (!client?.id) throw new Error('Dedicated setup client was not created');
try {
  const serviceUser = await admin(`/clients/${client.id}/service-account-user`);
  if (!serviceUser?.id) throw new Error('Setup service account was not created');
  const createRealm = await admin('/roles/create-realm');
  await admin(`/users/${serviceUser.id}/role-mappings/realm`, 'POST', [createRealm]);
  const openremote = await admin('/clients?clientId=openremote');
  if (!Array.isArray(openremote) || openremote.length !== 1)
    throw new Error('Master OpenRemote client was not found');
  const roleNames = ['read:admin', 'write:admin'];
  const roles = [];
  for (const name of roleNames) {
    roles.push(await admin(`/clients/${openremote[0].id}/roles/${encodeURIComponent(name)}`));
  }
  await admin(`/users/${serviceUser.id}/role-mappings/clients/${openremote[0].id}`, 'POST', roles);
  const serviceTokenResponse = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials',
      client_id: clientId, client_secret: secret }), signal: AbortSignal.timeout(10000),
  });
  if (!serviceTokenResponse.ok) throw new Error('Dedicated setup client could not obtain a token');
  const { access_token: serviceToken } = await serviceTokenResponse.json();
  const claims = JSON.parse(Buffer.from(serviceToken.split('.')[1], 'base64url').toString('utf8'));
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  const realmRoles = claims.realm_access?.roles || [];
  const orRoles = claims.resource_access?.openremote?.roles || [];
  if (!audience.includes('openremote') || !realmRoles.includes('create-realm')
      || roleNames.some(role => !orRoles.includes(role))) {
    throw new Error('Dedicated setup token is missing a required audience or role');
  }
  const realmRead = await fetch('http://manager:8080/api/master/realm', {
    headers: { Authorization: `Bearer ${serviceToken}` }, signal: AbortSignal.timeout(10000),
  });
  if (!realmRead.ok) throw new Error(`OpenRemote master realm read failed (${realmRead.status})`);
  const realms = await realmRead.json();
  if (!Array.isArray(realms) || !realms.some(realm => realm.name === 'gridex'))
    throw new Error('OpenRemote master realm read did not include the pilot realm');
  // Secret goes only to the parent process, which stores it in the private env.
  process.stdout.write(JSON.stringify({ clientId, clientUuid: client.id, secret }));
} catch (error) {
  await admin(`/clients/${client.id}`, 'DELETE');
  throw error;
}
