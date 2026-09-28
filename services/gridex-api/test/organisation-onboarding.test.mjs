import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRemoteRealmSetup, OrganisationOnboarding, validateOrganisationInvitation } from '../src/organisation-onboarding.mjs';

test('Manager callback provisioning preserves existing customer client settings', async () => {
  const setup = new OpenRemoteRealmSetup({ managerPublicOrigin: 'https://auth.example.test' });
  let client = { id: 'client-1', clientId: 'openremote', enabled: true, publicClient: true,
    standardFlowEnabled: true, redirectUris: ['https://localhost:8443/manager/*'],
    webOrigins: ['https://localhost:8443'], attributes: { existing: 'keep' } };
  const writes = [];
  setup.kc = async (path, _token, method = 'GET', body) => {
    if (path.endsWith('/clients?clientId=openremote')) return [{ id: client.id }];
    if (method === 'PUT') { writes.push(body); client = body; return null; }
    return client;
  };
  setup.token = async () => 'test-token';
  await setup.ensureManagerClient('novacom');
  await setup.ensureManagerClient('novacom');
  assert.equal(writes.length, 1);
  assert.deepEqual(client.redirectUris, ['https://localhost:8443/manager/*', 'https://auth.example.test/manager/*']);
  assert.deepEqual(client.webOrigins, ['https://localhost:8443', 'https://auth.example.test']);
  assert.equal(client.attributes.existing, 'keep');
});

const owner = () => ({ subject: 'owner-subject', realm: 'gridex', emailVerified: true,
  permissions: ['platform:manage'], authTime: Date.now()/1000 });

function fixture({ failAt } = {}) {
  const records = new Map(), organisations = new Map(), memberships = [];
  const calls = [];
  const query = async (sql, params = []) => {
    if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql)) return { rows: [] };
    if (sql.includes('SELECT 1 FROM organisations'))
      return { rows: organisations.has(params[0]) ? [{ '?column?': 1 }] : [] };
    if (sql.includes('INSERT INTO organisation_onboarding_invitations')) {
      const [id, organisationId, realm, name, email, createdBy] = params;
      if ([...records.values()].some(row => row.realm === realm)) throw new Error('duplicate realm');
      records.set(id, { id, organisation_id: organisationId, realm, name, email,
        created_by: createdBy, state: 'reserved', subject: null });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO audit_events')) return { rows: [] };
    if (sql.includes('UPDATE organisation_onboarding_invitations')) {
      const row = records.get(params[0]);
      if (sql.includes("last_error_code='resend_unconfirmed'")) {
        if (!row || row.state !== 'delivery_failed' || row.last_error_code !== 'resend_in_progress') return { rows: [] };
        row.last_error_code = 'resend_unconfirmed';
      } else if (sql.includes("expires_at=now()+interval '24 hours'")) {
        if (!row || row.state !== 'delivery_failed' || row.last_error_code !== 'resend_in_progress') return { rows: [] };
        row.state = 'sent'; row.expires_at = new Date(Date.now()+86400000); row.last_error_code = null;
        return { rows: [{ id: row.id, expiresAt: row.expires_at }] };
      } else if (sql.includes("SET state='delivery_failed',last_error_code='resend_in_progress'")) {
        if (!row || row.created_by !== params[1] || row.state !== 'sent') return { rows: [] };
        row.state = 'delivery_failed'; row.last_error_code = 'resend_in_progress';
      } else if (sql.includes('SET state=$3')) {
        if (row?.state !== params[1]) return { rows: [] };
        row.state = params[2];
        if (sql.includes('subject=$4')) row.subject = params[3];
      } else if (sql.includes("SET state='activating'")) {
        if (row?.state !== 'sent') return { rows: [] };
        row.state = 'activating';
      } else if (sql.includes("SET state='accepted'")) {
        if (row?.state !== 'activating') return { rows: [] };
        row.state = 'accepted';
      } else if (row) row.state = params[1];
      return { rows: row ? [{ id: row.id }] : [] };
    }
    if (sql.includes('SELECT * FROM organisation_onboarding_invitations')) {
      const row = records.get(params[0]);
      return { rows: row && row.subject === params[1] && row.email === params[2]
        && row.realm === params[3] && row.state === 'sent' ? [row] : [] };
    }
    if (sql.includes('SELECT realm,email,subject FROM organisation_onboarding_invitations')) {
      const row = records.get(params[0]);
      return { rows: row?.created_by === params[1] && row.state === 'sent' ? [row] : [] };
    }
    if (sql.includes('INSERT INTO organisations')) {
      organisations.set(params[2], { id: params[0], name: params[1], status: 'suspended' });
      return { rows: [] };
    }
    if (sql.includes('INSERT INTO organisation_memberships')) {
      memberships.push({ org: params[0], subject: params[1] });
      return { rows: [] };
    }
    if (sql.includes('UPDATE organisations')) {
      for (const org of organisations.values()) if (org.id === params[0]) org.status = 'active';
      return { rows: [] };
    }
    throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
  };
  const pool = { connect: async () => ({ query, release() {} }), query };
  const setup = Object.fromEntries(['createRealm','configurePortalClient','prepareUser',
    'sendActions','verifyRealm','verifyUser','verifyPreparedUser','grantAdministrator'].map(name => [name,
    async (...args) => { calls.push([name, ...args]); if (failAt === name) throw new Error('provider outage');
      if (name === 'prepareUser') return { subject: 'tenant-user' }; return true; }]));
  return { service: new OrganisationOnboarding(pool, setup), records, organisations, memberships, calls };
}

test('new-organisation request validates realm and exact platform authority before side effects', async () => {
  assert.deepEqual(validateOrganisationInvitation({ name: 'Example Energy', realm: 'example-energy',
    email: ' ADMIN@EXAMPLE.COM ' }), { name: 'Example Energy', realm: 'example-energy', email: 'admin@example.com' });
  for (const realm of ['gridex', 'master', 'XX', 'bad_name'])
    assert.throws(() => validateOrganisationInvitation({ name: 'Example Energy', realm, email: 'a@example.com' }));
  const { service, calls } = fixture();
  await assert.rejects(service.create({ ...owner(), realm: 'other' },
    { name: 'Example Energy', realm: 'example-energy', email: 'a@example.com' }), { code: 'permission_denied' });
  await assert.rejects(service.create({ ...owner(), authTime: Date.now()/1000-700 },
    { name: 'Example Energy', realm: 'example-energy', email: 'a@example.com' }), { code: 'recent_login_required' });
  assert.equal(calls.length, 0);
});

test('realm, identity and email are verified before acceptance activates membership', async () => {
  const f = fixture();
  const result = await f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy', email: 'admin@example.com' });
  assert.equal(result.state, 'sent');
  assert.deepEqual(f.calls.map(([name]) => name), ['createRealm','configurePortalClient','prepareUser','sendActions']);
  assert.equal(f.organisations.size, 0);
  assert.equal(f.memberships.length, 0);
  await assert.rejects(f.service.accept({ subject: 'tenant-user', realm: 'foreign',
    email: 'admin@example.com', emailVerified: true }, result.id), { code: 'invitation_unavailable' });
  const accepted = await f.service.accept({ subject: 'tenant-user', realm: 'example-energy',
    email: 'admin@example.com', emailVerified: true }, result.id);
  assert.equal(accepted.accepted, true);
  assert.equal(f.organisations.get('example-energy').status, 'active');
  assert.deepEqual(f.memberships, [{ org: accepted.organisationId, subject: 'tenant-user' }]);
  await assert.rejects(f.service.accept({ subject: 'tenant-user', realm: 'example-energy',
    email: 'admin@example.com', emailVerified: true }, result.id), { code: 'invitation_unavailable' });
});

test('provider failure leaves no active organisation and never reports a sent invitation', async () => {
  const f = fixture({ failAt: 'sendActions' });
  await assert.rejects(f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy',
    email: 'admin@example.com' }), { code: 'organisation_onboarding_incomplete' });
  assert.equal([...f.records.values()][0].state, 'delivery_failed');
  assert.equal(f.organisations.size, 0);
  assert.equal(f.memberships.length, 0);
});

test('only platform admin can resend the same sent identity; new link extends expiry without a new realm or user', async () => {
  const f = fixture();
  const created = await f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy', email: 'admin@example.com' });
  f.calls.length = 0;
  await assert.rejects(f.service.resend({ ...owner(), realm: 'example-energy' }, created.id), { code: 'permission_denied' });
  const result = await f.service.resend(owner(), created.id);
  assert.equal(result.state, 'sent');
  assert.ok(result.expiresAt > new Date());
  assert.deepEqual(f.calls.map(([name]) => name), ['verifyRealm','verifyPreparedUser','sendActions']);
  assert.equal(f.records.size, 1);
  assert.equal(f.organisations.size, 0);
  f.records.get(created.id).state = 'accepted';
  await assert.rejects(f.service.resend(owner(), created.id), { code: 'invitation_unavailable' });
});

test('uncertain resend never loops or returns sent and must be reconciled', async () => {
  const f = fixture();
  const created = await f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy', email: 'admin@example.com' });
  f.service.setup.sendActions = async () => { throw new Error('provider timeout'); };
  await assert.rejects(f.service.resend(owner(), created.id), { code: 'organisation_resend_unconfirmed' });
  assert.equal(f.records.get(created.id).state, 'delivery_failed');
  assert.equal(f.records.get(created.id).last_error_code, 'resend_unconfirmed');
  await assert.rejects(f.service.resend(owner(), created.id), { code: 'invitation_unavailable' });
});

test('OpenRemote role failure keeps the organisation suspended and no portal access', async () => {
  const f = fixture({ failAt: 'grantAdministrator' });
  const result = await f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy',
    email: 'admin@example.com' });
  await assert.rejects(f.service.accept({ subject: 'tenant-user', realm: 'example-energy',
    email: 'admin@example.com', emailVerified: true }, result.id), { code: 'organisation_activation_incomplete' });
  assert.equal(f.organisations.get('example-energy').status, 'suspended');
});

test('pending organisation invitation is visible only to its verified customer before membership', async () => {
  const calls = [];
  const row = { id: 'invitation', organisationId: 'organisation', realm: 'example-energy', name: 'Example Energy' };
  const pool = { query: async (sql, params) => {
    calls.push(params);
    assert.match(sql, /state='sent' AND expires_at>now\(\)/);
    return { rows: params[0] === 'customer-subject' && params[1] === 'admin@example.com'
      && params[2] === 'example-energy' ? [row] : [] };
  } };
  const onboarding = new OrganisationOnboarding(pool, {});
  const principal = { subject: 'customer-subject', email: 'ADMIN@example.com', emailVerified: true,
    realm: 'example-energy', roles: [], permissions: [] };
  assert.deepEqual(await onboarding.list(principal), [row]);
  assert.deepEqual(await onboarding.list({ ...principal, realm: 'gridex' }), []);
  assert.deepEqual(await onboarding.list({ ...principal, emailVerified: false }), []);
  assert.deepEqual(calls[0], ['customer-subject', 'admin@example.com', 'example-energy']);
  assert.equal(calls.length, 2);
});

test('new realms reuse the Keycloak Mailgun provider without SMTP configuration', async () => {
  const calls = [];
  let identityRealm = { realm: 'example-energy', displayName: 'Example Energy', enabled: true };
  const config = { openRemoteBaseUrl: 'http://manager:8080',
    realmSetupAdminBaseUrl: 'http://keycloak:8080/auth/admin/realms',
    oidcAudience: 'gridex-portal', portalOrigin: 'https://gridex.example.test' };
  const setup = new OpenRemoteRealmSetup(config, async (url, options) => {
    calls.push([url, options]);
    if (options.method === 'POST') return new Response(null, { status: 201 });
    if (options.method === 'PUT') {
      identityRealm = JSON.parse(options.body);
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/api/master/realm/example-energy'))
      return Response.json({ name: 'example-energy', enabled: true });
    if (url.endsWith('/auth/admin/realms/example-energy')) return Response.json(identityRealm);
    throw new Error('Unexpected provider request');
  });
  setup.token = async () => 'fixture-token';
  await setup.createRealm({ realm: 'example-energy', name: 'Example Energy' });
  assert.equal(calls[0][0], 'http://manager:8080/api/master/realm');
  assert.equal(identityRealm.displayName, 'GrideX');
  assert.equal(identityRealm.resetPasswordAllowed, true);
  await setup.sendActions('example-energy', 'tenant-user');
  assert.equal(calls.length, 6);
  const [url, request] = calls[5];
  assert.ok(url.includes('/example-energy/users/tenant-user/execute-actions-email?'));
  assert.equal(new URL(url).searchParams.get('redirect_uri'), 'https://gridex.example.test/login/?realm=example-energy');
  assert.deepEqual(JSON.parse(request.body), ['VERIFY_EMAIL','UPDATE_PASSWORD']);
  assert.ok(calls.every(([, request]) => !request.body?.includes('smtpServer')));
});
