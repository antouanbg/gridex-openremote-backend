import test from 'node:test';
import assert from 'node:assert/strict';
import { InvitationService } from '../src/invitations.mjs';
import { OrganisationOnboarding } from '../src/organisation-onboarding.mjs';

test('recipient resend uses the existing member identity once and never accepts the invitation', async () => {
  let used=false, sent=0;
  const pool={async query(sql,args){
    if(sql.includes('recipient_resend_used_at=now()')){
      if(used)return {rows:[]};
      used=true;assert.deepEqual(args,['member@example.invalid']);
      return {rows:[{id:'invite',subject:'member-subject',email:'member@example.invalid',realm:'novacom'}]};
    }
    assert.match(sql,/SET expires_at=now\(\)\+interval '24 hours'/);
    return {rows:[]};
  }};
  const identity={async inspectMemberUser(){return {needsPassword:true};},async sendActions(){sent++;}};
  const service=new InvitationService(pool,identity);
  await service.resendToRecipient('member@example.invalid');
  await service.resendToRecipient('member@example.invalid');
  assert.equal(sent,1);
});

test('recipient resend for a first administrator uses same realm and subject once', async () => {
  let used=false,sent=0;
  const pool={async query(sql){
    if(sql.includes('recipient_resend_used_at=now()')){
      if(used)return {rows:[]};used=true;
      return {rows:[{id:'invite',realm:'novacom',subject:'admin-subject',email:'admin@example.invalid'}]};
    }
    return {rows:[]};
  }};
  const setup={async verifyPreparedUser(realm,subject,email){assert.deepEqual([realm,subject,email],['novacom','admin-subject','admin@example.invalid']);},
    async sendActions(){sent++;}};
  const service=new OrganisationOnboarding(pool,setup,'gridex');
  await service.resendToRecipient('admin@example.invalid');
  await service.resendToRecipient('admin@example.invalid');
  assert.equal(sent,1);
});
