// Rollback only: delete the exact setup client created during an unsuccessful
// activation. The client UUID and master password arrive on stdin.
let raw = '';
for await (const chunk of process.stdin) raw += chunk;
const { password, clientId } = JSON.parse(raw);
if (!/^[0-9a-f-]{36}$/i.test(clientId)) throw new Error('Invalid setup client UUID');
const base = 'http://keycloak:8080/auth';
const tokenResponse = await fetch(`${base}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli',
    username: 'admin', password }), signal: AbortSignal.timeout(10000),
});
if (!tokenResponse.ok) throw new Error('Master administrator authentication failed');
const { access_token: token } = await tokenResponse.json();
const lookup = await fetch(`${base}/admin/realms/master/clients?clientId=gridex-realm-setup`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000),
});
if (!lookup.ok) throw new Error('Setup client lookup failed');
const matches = await lookup.json();
if (matches.length !== 1 || matches[0].id !== clientId)
  throw new Error('Setup client identity changed; automatic removal stopped');
const deleted = await fetch(`${base}/admin/realms/master/clients/${clientId}`, {
  method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(10000),
});
if (deleted.status !== 204) throw new Error('Setup client removal failed');
process.stdout.write('SETUP_CLIENT_REMOVED');
