import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvitation, EnrollmentIdentity, InvitationService } from '../src/invitations.mjs';
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
test('organisation administrator cannot create an identity for a Site outside their grant', async () => {
  let identityCalls=0;
  const queries=[];
  const db={async query(sql,args){
    queries.push({sql,args});
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[{role:'administrator',all_sites:false}]};
    if(sql.includes('SELECT id FROM sites'))return {rows:[]};
    return {rows:[]};
  },release(){}};
  const service=new InvitationService({connect:async()=>db},{prepareUser:async()=>{identityCalls++;return {subject:'invited'};}});
  await assert.rejects(service.create({subject:'limited-admin'},'22222222-2222-4222-8222-222222222222',
    {email:'user@example.invalid',role:'viewer',siteIds:[site]}),{code:'site_access_denied'});
  assert.equal(identityCalls,0);
  assert.equal(queries.some(item=>item.sql.includes('INSERT INTO organisation_invitations')),false);
  assert.equal(queries.find(item=>item.sql.includes('SELECT id FROM sites')).args[2],false);
});
