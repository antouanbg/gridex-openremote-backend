import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { MemoryRepository } from '../src/repository.mjs';
import { createApp } from '../src/app.mjs';

test('database roles, selected sites and revocation override a stale admin token', async () => {
  const a = { id: 'a', organisationId: 'org-a', name: 'A' };
  const b = { id: 'b', organisationId: 'org-b', name: 'B' };
  const c = { id: 'c', organisationId: 'org-b', name: 'C' };
  const repository = new MemoryRepository({ sites: [a, b, c], memberships: [
    { subject: 'user', organisationId: 'org-a', role: 'administrator', allSites: true },
    { subject: 'user', organisationId: 'org-b', role: 'viewer', siteIds: ['b'] },
  ] });
  const identity = { subject: 'user', roles: ['admin'], permissions: ['hardware:manage'] };
  const server = createServer(createApp({ repository, authenticate: async () => identity,
    config: { allowedOrigins: new Set(), writesEnabled: true, maximumBodyBytes: 1000 }, openRemote: {} }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    assert.deepEqual((await (await fetch(`${url}/sites`)).json()).sites.map(s => s.id), ['a', 'b']);
    assert.equal((await fetch(`${url}/sites/b/hardware`)).status, 200);
    assert.equal((await fetch(`${url}/sites/c/hardware`)).status, 404);
    assert.equal((await fetch(`${url}/sites/b/hardware-configurations`, { method: 'POST', body: '{}' })).status, 403);
    repository.memberships = repository.memberships.filter(m => m.organisationId !== 'org-b');
    assert.equal((await fetch(`${url}/sites/b/hardware`)).status, 404);
    repository.memberships = [];
    assert.equal((await fetch(`${url}/sites`)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('new membership without explicit site scope grants no site access', async () => {
  const repository = new MemoryRepository({ sites: [{ id: 'a', organisationId: 'org' }],
    memberships: [{ subject: 'user', organisationId: 'org', role: 'administrator' }] });
  assert.deepEqual(await repository.listAccessibleSites('user'), []);
});
