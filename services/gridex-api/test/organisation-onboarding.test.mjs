import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenRemoteRealmSetup, OrganisationOnboarding, validateOrganisationInvitation } from '../src/organisation-onboarding.mjs';

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
      if (sql.includes('SET state=$3')) {
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
    'sendActions','verifyRealm','verifyUser','grantAdministrator'].map(name => [name,
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

test('OpenRemote role failure keeps the organisation suspended and no portal access', async () => {
  const f = fixture({ failAt: 'grantAdministrator' });
  const result = await f.service.create(owner(), { name: 'Example Energy', realm: 'example-energy',
    email: 'admin@example.com' });
  await assert.rejects(f.service.accept({ subject: 'tenant-user', realm: 'example-energy',
    email: 'admin@example.com', emailVerified: true }, result.id), { code: 'organisation_activation_incomplete' });
  assert.equal(f.organisations.get('example-energy').status, 'suspended');
});

test('new realm configures and verifies identity email before sending an invitation', async () => {
  const calls = [];
  const config = { openRemoteBaseUrl: 'http://manager:8080',
    realmSetupAdminBaseUrl: 'http://keycloak:8080/auth/admin/realms',
    realmSmtpHost: 'smtp.eu.mailgun.org', realmSmtpPort: '587',
    realmSmtpFrom: 'invite@mg.example.test', realmSmtpUser: 'sender', realmSmtpPassword: 'private' };
  const setup = new OpenRemoteRealmSetup(config, async (url, options) => {
    calls.push([url, options]);
    if (options.method === 'POST') return new Response(null, { status: 201 });
    if (options.method === 'PUT') return new Response(null, { status: 204 });
    if (url.endsWith('/api/master/realm/example-energy'))
      return Response.json({ name: 'example-energy', enabled: true });
    return Response.json({ realm: 'example-energy', smtpServer: calls.some(([, request]) => request.method === 'PUT')
      ? { host: config.realmSmtpHost, from: config.realmSmtpFrom } : {} });
  });
  setup.token = async () => 'fixture-token';
  await setup.createRealm({ realm: 'example-energy', name: 'Example Energy' });
  assert.equal(calls[0][0], 'http://manager:8080/api/master/realm');
  const smtp = JSON.parse(calls.find(([url, options]) => url.endsWith('/example-energy') && options.method === 'PUT')[1].body).smtpServer;
  assert.equal(smtp.host, config.realmSmtpHost);
  assert.equal(smtp.password, 'private');
  const missing = new OpenRemoteRealmSetup({ ...config, realmSmtpPassword: '' }, async () => { throw new Error('no side effect allowed'); });
  await assert.rejects(missing.createRealm({ realm: 'another', name: 'Another' }), { code: 'realm_email_unavailable' });
});
