// Local staging only. Settings arrive on stdin; tokens never leave this process.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const settings = JSON.parse(fs.readFileSync(0, 'utf8'));
const kc = 'http://keycloak:8080/auth';
async function req(url, options = {}) {
  const r = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${new URL(url).pathname}`);
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const adminToken = await req(`${kc}/realms/master/protocol/openid-connect/token`, {
  method: 'POST', body: new URLSearchParams({ client_id: 'admin-cli', grant_type: 'password',
    username: 'admin', password: settings.OR_ADMIN_PASSWORD }),
});
const headers = { Authorization: `Bearer ${adminToken.access_token}`, 'Content-Type': 'application/json' };
const clients = `${kc}/admin/realms/gridex/clients`;
const clientId = `acceptance-${randomUUID()}`;
const secret = randomUUID() + randomUUID();
const orgA = randomUUID(), orgB = randomUUID(), siteA = randomUUID(), siteB = randomUUID();
const db = new pg.Client(); await db.connect();
let client;
try {
  await req(clients, { headers, method: 'POST', body: JSON.stringify({ clientId, secret,
    publicClient: false, standardFlowEnabled: false, serviceAccountsEnabled: true,
    directAccessGrantsEnabled: false, protocol: 'openid-connect', protocolMappers: [
      { name: 'test-audience', protocol: 'openid-connect', protocolMapper: 'oidc-audience-mapper',
        config: { 'included.client.audience': 'gridex-portal', 'access.token.claim': 'true' } },
      { name: 'test-viewer', protocol: 'openid-connect', protocolMapper: 'oidc-hardcoded-claim-mapper',
        config: { 'claim.name': 'realm_access.roles', 'claim.value': '["viewer"]',
          'jsonType.label': 'JSON', 'access.token.claim': 'true', 'id.token.claim': 'false' } },
    ] }) });
  [client] = await req(`${clients}?clientId=${clientId}`, { headers });
  const user = await req(`${clients}/${client.id}/service-account-user`, { headers });
  await db.query('BEGIN');
  for (const [org, site, label] of [[orgA, siteA, 'A'], [orgB, siteB, 'B']]) {
    await db.query('INSERT INTO organisations(id,name,openremote_realm) VALUES($1,$2,$3)', [org, `Acceptance ${label}`, `acceptance-${org}`]);
    await db.query('INSERT INTO sites(id,organisation_id,name,timezone,openremote_realm) VALUES($1,$2,$3,$4,$5)', [site, org, `Acceptance ${label}`, 'UTC', 'gridex']);
  }
  await db.query('INSERT INTO organisation_memberships(organisation_id,subject,role) VALUES($1,$2,$3)', [orgA, user.id, 'viewer']);
  await db.query('COMMIT');
  const token = await req(`${kc}/realms/gridex/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: secret }),
  });
  const auth = { Authorization: `Bearer ${token.access_token}` };
  const base = 'http://127.0.0.1:8080/api/v1';
  const listing = await req(`${base}/sites`, { headers: auth });
  assert.deepEqual(listing.sites.map(s => s.id), [siteA]);
  assert.equal((await fetch(`${base}/sites/${siteA}/hardware`, { headers: auth })).status, 200);
  assert.equal((await fetch(`${base}/sites/${siteB}/hardware`, { headers: auth })).status, 404);
  assert.equal((await fetch(`${base}/sites`, { headers: { Authorization: 'Bearer invalid' } })).status, 401);
  console.log('PASS real JWT/JWKS + PostgreSQL: own site 200; other tenant 404; filtered list; invalid token 401');
} finally {
  await db.query('ROLLBACK');
  await db.query('DELETE FROM organisation_memberships WHERE organisation_id=ANY($1::uuid[])', [[orgA, orgB]]);
  await db.query('DELETE FROM sites WHERE id=ANY($1::uuid[])', [[siteA, siteB]]);
  await db.query('DELETE FROM organisations WHERE id=ANY($1::uuid[])', [[orgA, orgB]]);
  await db.end();
  if (client) await req(`${clients}/${client.id}`, { headers, method: 'DELETE' });
  console.log('Removed temporary acceptance data and client');
}
