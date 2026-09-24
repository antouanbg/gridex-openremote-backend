import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.mjs';
import { withMembershipRoles } from '../src/auth.mjs';

const owner='11111111-1111-4111-8111-111111111111';

test('global administration is granted only to configured verified subject, never by email or realm role', () => {
  const configured=loadConfig({GRIDEX_PLATFORM_ADMIN_SUBJECTS:owner}).platformAdminSubjects;
  const identity={subject:owner,email:'owner@example.com',emailVerified:true,roles:['admin']};
  assert.equal(withMembershipRoles(identity,[],configured).permissions.includes('platform:manage'),true);
  assert.equal(withMembershipRoles(identity,[],configured).roles.includes('platform_administrator'),true);
  assert.equal(withMembershipRoles({...identity,emailVerified:false},[],configured).permissions.includes('platform:manage'),false);
  assert.equal(withMembershipRoles({...identity,subject:'other'},[],configured).permissions.includes('platform:manage'),false);
  assert.equal(withMembershipRoles(identity,[],new Set()).permissions.includes('platform:manage'),false);
  assert.equal(withMembershipRoles({...identity,subject:'other'},['admin'],configured).permissions.includes('platform:manage'),false);
  assert.throws(()=>loadConfig({GRIDEX_PLATFORM_ADMIN_SUBJECTS:'owner@example.com'}));
});
