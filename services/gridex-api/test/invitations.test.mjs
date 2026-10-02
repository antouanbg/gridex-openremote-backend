import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInvitation, validateMemberAccess, EnrollmentIdentity, InvitationService } from '../src/invitations.mjs';
import { loadConfig } from '../src/config.mjs';
const site = '11111111-1111-4111-8111-111111111111';
const names = {firstName:'Мария',lastName:'Петрова'};
test('unverified live member access stays disabled by default', () => {
  assert.equal(loadConfig({}).memberAccessEnabled,false);
  assert.equal(loadConfig({GRIDEX_MEMBER_ACCESS_ENABLED:'true'}).memberAccessEnabled,true);
});
test('invitation validates email, explicit site scope and non-administrator role', () => {
  assert.deepEqual(validateInvitation({ ...names,email: ' User@example.invalid ', role: 'viewer', siteIds: [site, site] }),
    { ...names,email: 'user@example.invalid', role: 'viewer', siteIds: [site] });
  assert.deepEqual(validateInvitation({ ...names,email: 'user@example.invalid', role: 'viewer', siteIds: [] }).siteIds, []);
  for (const patch of [{ email: 'bad' }, { role: 'administrator' }, { role: 'admin' }, { siteIds: null }, { siteIds: ['bad'] }]) {
    assert.throws(() => validateInvitation({ ...names,email: 'user@example.invalid', role: 'viewer', siteIds: [site], ...patch }));
  }
  assert.throws(()=>validateInvitation({email:'user@example.invalid',role:'viewer',siteIds:[]}),{code:'invalid_invitation'});
  assert.deepEqual(validateInvitation({email:'user@example.invalid',role:'viewer',siteIds:[]},{requireNames:false}).firstName,'');
  assert.deepEqual(validateMemberAccess({role:'operator',siteIds:[site,site]}),{role:'operator',siteIds:[site]});
  assert.throws(()=>validateMemberAccess({role:'administrator',siteIds:[]}),{code:'invalid_member_access'});
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
    {...names,email:'user@example.invalid',role:'viewer',siteIds:[site]}),{code:'site_access_denied'});
  assert.equal(identityCalls,0);
  assert.equal(queries.some(item=>item.sql.includes('INSERT INTO organisation_invitations')),false);
  assert.equal(queries.find(item=>item.sql.includes('SELECT id FROM sites')).args[2],false);
});
test('sent member invitations are visible only to their creating administrator in the same realm', async () => {
  const calls=[];
  const db={async query(sql,args){calls.push({sql,args});
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:args[2]==='customer'?[{role:'administrator',all_sites:true,realm:'customer'}]:[]};
    if(sql.includes('SELECT id,email,first_name'))return {rows:[{id:'invite',state:'sent',email:'member@example.invalid'}]};
    return {rows:[]};
  },release(){}};
  const service=new InvitationService({connect:async()=>db},{});
  const rows=await service.listCreated({subject:'admin',realm:'customer'},'org');
  assert.equal(rows[0].state,'sent');
  assert.deepEqual(calls.find(item=>item.sql.includes('FROM organisation_invitations WHERE organisation_id')).args,['org','admin']);
  await assert.rejects(service.listCreated({subject:'admin',realm:'another'},'org'),{code:'permission_denied'});
});
test('resend only claims a sent invitation and never creates another identity or membership', async () => {
  const calls=[];
  const db={async query(sql,args){calls.push({sql,args});
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[{role:'administrator',all_sites:true,realm:'customer'}]};
    if(sql.includes('SELECT subject,email,site_ids'))return {rows:[{subject:'member',email:'member@example.invalid',siteIds:[]}]};
    if(sql.includes('SELECT id FROM sites'))return {rows:[]};
    if(sql.includes('RETURNING id,state,expires_at'))return {rows:[{id:'invite',state:'sent',expiresAt:'tomorrow'}]};
    return {rows:[]};
  },release(){}};
  let inspected=0,sent=0;
  const identity={async inspectMemberUser(subject,email,realm){inspected++;assert.deepEqual([subject,email,realm],['member','member@example.invalid','customer']);return {needsPassword:true};},
    async sendActions(subject,needsPassword,realm){sent++;assert.deepEqual([subject,needsPassword,realm],['member',true,'customer']);}};
  const service=new InvitationService({connect:async()=>db},identity);
  const result=await service.resend({subject:'admin',realm:'customer'},'org','invite');
  assert.equal(result.state,'sent');assert.equal(inspected,1);assert.equal(sent,1);
  assert.equal(calls.some(item=>item.sql.includes('INSERT INTO organisation_memberships')),false);
  assert.equal(calls.some(item=>item.sql.includes('INSERT INTO organisation_invitations')),false);
});

test('only an organisation administrator may read its member roster', async () => {
  const db={async query(sql){
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[]};
    return {rows:[]};
  },release(){}};
  const service=new InvitationService({connect:async()=>db},{});
  await assert.rejects(service.listMembers({subject:'viewer',realm:'customer'},'org'),{code:'permission_denied'});
});

test('member roster verifies exact user and Site links once per realm',async()=>{
  const db={async query(sql){
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[{role:'administrator',all_sites:true,realm:'customer'}]};
    if(sql.includes('SELECT m.subject,m.role'))return {rows:[{subject:'member',role:'viewer',siteIds:[site],services:[]}]};
    if(sql.includes('SELECT id,name,openremote_site_asset_id'))return {rows:[{id:site,name:'Site',assetId:'asset'}]};
    if(sql.includes('SELECT s.id AS "siteId"'))return {rows:[{siteId:site,assetId:'asset'}]};
    return {rows:[]};
  },release(){}};
  let reads=0;
  const remote={realmUserAssetLinks:async()=>{reads++;return [
    {id:{realm:'customer',userId:'member',assetId:'asset'}},
    {id:{realm:'customer',userId:'other',assetId:'foreign'}}];}};
  const service=new InvitationService({connect:async()=>db},{assetLinkCredentials:async()=>({token:'token',apiRealm:'master'})},remote);
  const result=await service.listMembers({subject:'admin',realm:'customer',accessToken:'user-token'},'org');
  assert.deepEqual(result.members[0].verifiedSiteIds,[site]);
  assert.equal(reads,1);
});

test('administrator membership cannot be edited through ordinary member access', async () => {
  const calls=[];
  const db={async query(sql,args){calls.push({sql,args});
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[{role:'administrator',all_sites:true,realm:'customer'}]};
    if(sql.includes('SELECT role FROM organisation_memberships'))return {rows:[{role:'administrator'}]};
    return {rows:[]};
  },release(){}};
  const remote={userAssetLinks:async()=>{throw Error('Must not reach OpenRemote');}};
  const service=new InvitationService({connect:async()=>db},{},remote);
  await assert.rejects(service.updateMember({subject:'admin',realm:'customer',accessToken:'token'},'org','other-admin',
    {role:'viewer',siteIds:[]}),{code:'administrator_protected'});
  assert.equal(calls.some(item=>item.sql.includes('UPDATE organisation_memberships')),false);
});

test('member Site access is verified in OpenRemote before the local grant is committed', async () => {
  const calls=[];
  const db={async query(sql,args){calls.push({sql,args});
    if(sql.includes('SELECT m.role,m.all_sites'))return {rows:[{role:'administrator',all_sites:true,realm:'customer'}]};
    if(sql.includes('SELECT role FROM organisation_memberships'))return {rows:[{role:'viewer'}]};
    if(sql.includes('SELECT id FROM sites'))return {rows:[{id:site}]};
    if(sql.includes('SELECT id,openremote_site_asset_id'))return {rows:[{id:site,assetId:'site-asset'}]};
    if(sql.includes('SELECT s.id AS "siteId"'))return {rows:[
      {siteId:site,assetId:'site-asset'}, {siteId:site,assetId:'rock-asset'},
      {siteId:site,assetId:'esp-asset'}]};
    return {rows:[]};
  },release(){}};
  const linked=new Set();
  const remote={userAssetLinks:async()=>[...linked].map(assetId=>({id:{assetId}})),
    linkUserAsset:async id=>{linked.add(id);},deleteUserAssetLink:async id=>{linked.delete(id);}};
  const service=new InvitationService({connect:async()=>db},{assetLinkCredentials:async()=>({token:'service-token',apiRealm:'customer'})},remote);
  const result=await service.updateMember({subject:'admin',realm:'customer',accessToken:'token'},'org','member',
    {role:'operator',siteIds:[site]});
  assert.deepEqual(result,{subject:'member',role:'operator',siteIds:[site]});
  assert.deepEqual([...linked].sort(),['esp-asset','rock-asset','site-asset']);
  assert.equal(calls.some(item=>item.sql.includes('UPDATE organisation_memberships')),true);
});
