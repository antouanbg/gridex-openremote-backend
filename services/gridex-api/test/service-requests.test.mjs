import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRequests } from '../src/service-requests.mjs';

const organisationId = '11111111-1111-4111-8111-111111111111';
const requestId = '22222222-2222-4222-8222-222222222222';
const customer = { subject: 'customer-subject', realm: 'novacom', email: 'person@example.test', emailVerified: true };
const platform = { subject: 'owner', realm: 'gridex', emailVerified: true };
const entitlements = {
  platform(principal) { if (principal.subject !== 'owner') throw Error('platform denied'); },
  async organisation(principal, id) { if (principal.subject !== 'org-admin' || id !== organisationId) throw Error('organisation denied'); },
};

test('member request is BG-only, idempotent and never grants a service', async () => {
  const sql = [];
  const db = { query: async (query) => {
    sql.push(query);
    if (query.includes('INSERT INTO service_requests')) return { rows: [{ id: requestId }] };
    return { rows: [] };
  }, release() {} };
  const pool = { query: async (query) => {
    sql.push(query);
    if (query.includes('JOIN organisation_memberships m')) return { rows: [{ '?column?': 1 }] };
    if (query.includes('FROM service_catalog')) return { rows: [{ requestable: true }] };
    return { rows: [] };
  }, connect: async () => db };
  const requests = new ServiceRequests(pool, entitlements, null);
  await assert.rejects(requests.create(customer, { organisationId, serviceCode: 'day_ahead', country: 'FR', zone: 'FR' }),
    error => error.code === 'service_request_invalid');
  assert.deepEqual(await requests.create(customer, { organisationId, serviceCode: 'day_ahead', country: 'BG', zone: 'BG' }),
    { id: requestId, created: true });
  assert.equal(sql.some(query => query.includes('INSERT INTO member_services') || query.includes('INSERT INTO organisation_services')), false);
  assert.equal(sql.some(query => query.includes('INSERT INTO service_request_events')), true);
});

test('platform approval grants only organisation and BG scope, never requester membership', async () => {
  const sql = [];
  const db = { query: async (query) => {
    sql.push(query);
    if (query.includes('JOIN organisations o ON o.id=r.organisation_id'))
      return { rows: [{ id: requestId, organisation_id: organisationId, service_code: 'day_ahead', state: 'open', status: 'active' }] };
    return { rows: [] };
  }, release() {} };
  const requests = new ServiceRequests({ connect: async () => db }, entitlements,
    { collectionZones: async () => [{ country: 'BG', zone: 'BG', enabled: true }] });
  assert.deepEqual(await requests.approvePlatform(platform, requestId),
    { id: requestId, stage: 'awaiting_organisation' });
  assert.equal(sql.some(query => query.includes('INSERT INTO organisation_services')), true);
  assert.equal(sql.some(query => query.includes('INSERT INTO organisation_market_zones')), true);
  assert.equal(sql.some(query => query.includes('INSERT INTO member_services')), false);
});

test('organisation approval requires platform grant, current member and matching organisation', async () => {
  const sql = [];
  const db = { query: async (query) => {
    sql.push(query);
    if (query.includes('FROM service_requests r WHERE r.id=$1'))
      return { rows: [{ id: requestId, organisation_id: organisationId, service_code: 'visualisations', subject: customer.subject, realm: customer.realm }] };
    return { rows: [] };
  }, release() {} };
  const requests = new ServiceRequests({ connect: async () => db }, entitlements, null);
  await assert.rejects(requests.approveOrganisation({ subject: 'org-admin' }, organisationId, requestId),
    error => error.code === 'service_not_enabled');
  assert.equal(sql.some(query => query.includes('INSERT INTO member_services')), false);
  await assert.rejects(requests.approveOrganisation({ subject: 'outsider' }, organisationId, requestId));
});

test('request lists retain strict subject/realm and organisation boundaries', async () => {
  const calls = [];
  const pool = { query: async (query, params) => { calls.push({ query, params }); return { rows: [] }; } };
  const requests = new ServiceRequests(pool, entitlements, null);
  await requests.list(customer, 'mine');
  assert.deepEqual(calls[0].params, [customer.subject, customer.realm]);
  assert.match(calls[0].query, /r\.subject=\$1 AND r\.realm=\$2/);
  await requests.list({ subject: 'org-admin', emailVerified: true }, 'organisation', organisationId);
  assert.deepEqual(calls[1].params, [organisationId]);
  assert.match(calls[1].query, /r\.organisation_id=\$1/);
});
