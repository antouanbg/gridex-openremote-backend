import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvitation, EnrollmentIdentity } from '../src/invitations.mjs';
const site = '11111111-1111-4111-8111-111111111111';
test('invitation validates email, explicit sites and non-administrator role', () => {
  assert.deepEqual(validateInvitation({ email: ' User@example.invalid ', role: 'viewer', siteIds: [site, site] }),
    { email: 'user@example.invalid', role: 'viewer', siteIds: [site] });
  for (const patch of [{ email: 'bad' }, { role: 'administrator' }, { role: 'admin' }, { siteIds: [] }, { siteIds: ['bad'] }]) {
    assert.throws(() => validateInvitation({ email: 'user@example.invalid', role: 'viewer', siteIds: [site], ...patch }));
  }
});
test('missing enrollment configuration fails closed before identity or email requests', async () => {
  await assert.rejects(new EnrollmentIdentity({}).prepareUser('user@example.invalid'), { code: 'enrollment_unavailable' });
});
