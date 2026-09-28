// One-time, idempotent repair inside the gridex-api container. Never print
// credentials or realm JSON. Future realms use createRealm() instead.
if (process.argv[2] !== '--apply' || process.env.GRIDEX_REALM_SETUP_ENABLED !== 'true')
  throw new Error('Explicit --apply and configured realm setup are required.');
const tokenUrl = process.env.GRIDEX_REALM_SETUP_TOKEN_URL || 'http://keycloak:8080/auth/realms/master/protocol/openid-connect/token';
const adminBase = process.env.GRIDEX_REALM_SETUP_ADMIN_URL || 'http://keycloak:8080/auth/admin/realms';
const clientId = process.env.GRIDEX_REALM_SETUP_CLIENT_ID || 'gridex-realm-setup';
const secret = process.env.GRIDEX_REALM_SETUP_CLIENT_SECRET;
if (!tokenUrl || !adminBase || !clientId || !secret) throw new Error('Realm setup is incomplete.');
const tokenResponse = await fetch(tokenUrl, { method: 'POST', body: new URLSearchParams({
  grant_type: 'client_credentials', client_id: clientId, client_secret: secret,
}), signal: AbortSignal.timeout(10000) });
if (!tokenResponse.ok) throw new Error(`Setup authentication failed: ${tokenResponse.status}`);
const { access_token: token } = await tokenResponse.json();
if (!token) throw new Error('Setup authentication returned no token.');
const url = `${adminBase.replace(/\/$/, '')}/novacom`;
const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
const get = async () => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Realm read failed: ${response.status}`);
  return response.json();
};
const before = await get();
if (before.realm !== 'novacom' || !before.enabled) throw new Error('Unexpected realm; no changes made.');
if (before.resetPasswordAllowed === true) {
  console.log('NOVACOM_PASSWORD_RESET_ALREADY_ENABLED');
  process.exit(0);
}
if (before.resetPasswordAllowed !== false) throw new Error('Unknown initial reset state.');
const response = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...before, resetPasswordAllowed: true }), signal: AbortSignal.timeout(10000) });
if (!response.ok) throw new Error(`Realm update failed: ${response.status}`);
const after = await get();
if (after.realm !== 'novacom' || !after.resetPasswordAllowed)
  throw new Error('Password reset change was not verified.');
console.log('NOVACOM_PASSWORD_RESET_ENABLED previous=false');
