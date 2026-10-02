// Read-only deployment probe, run inside the existing API container.
// Uses real DB memberships and OpenRemote links; not a browser-login test.
import assert from 'node:assert/strict';
import {loadConfig} from '/app/src/config.mjs';
import {createRepository} from '/app/src/repository.mjs';
import {ServiceEntitlements} from '/app/src/service-entitlements.mjs';
import {ServiceRequests} from '/app/src/service-requests.mjs';
import {OpenRemoteRealmSetup} from '/app/src/organisation-onboarding.mjs';
import {OpenRemoteClient} from '/app/src/openremote-client.mjs';
import {InvitationService} from '/app/src/invitations.mjs';
import {mailgunConfig} from '/app/src/mailgun.mjs';

const config=loadConfig(),repository=createRepository(config),pool=repository.pool;
try{
  assert.equal(config.memberAccessEnabled,true);
  mailgunConfig();
  const setup=new OpenRemoteRealmSetup(config);
  const remote=new OpenRemoteClient(config,fetch,realm=>setup.assetServiceCredentials(realm));
  const invitations=new InvitationService(pool,{assetLinkCredentials:realm=>setup.assetServiceCredentials(realm)},remote,true);
  const entitlements=new ServiceEntitlements(pool,config),requests=new ServiceRequests(pool,entitlements,null);
  const orgs=(await pool.query(`SELECT o.id,o.openremote_realm AS realm,m.subject FROM organisations o
    JOIN organisation_memberships m ON m.organisation_id=o.id AND m.role='administrator'
    WHERE o.status='active' ORDER BY o.openremote_realm`)).rows;
  const results=[];
  for(const org of orgs){
    const profile=await setup.verifiedNotificationProfile(org.realm,org.subject);
    const principal={subject:org.subject,realm:org.realm,email:profile.email,emailVerified:true};
    const roster=await invitations.listMembers(principal,org.id);
    const services=await entitlements.listOrganisation(principal,org.id);
    assert.deepEqual(services.map(item=>item.code).sort(),['analysis','day_ahead','forecasting','meteorology','visualisations']);
    await requests.list(principal,'organisation',org.id);
    await assert.rejects(entitlements.listOrganisation({...principal,realm:'wrong-realm'},org.id),error=>error.status===403);
    const viewer=roster.members.find(member=>member.role==='viewer');
    if(viewer)await assert.rejects(entitlements.listOrganisation({...principal,subject:viewer.subject},org.id),error=>error.status===403);
    results.push({realm:org.realm,members:roster.members.length,total:roster.total,catalogue:services.length,
      enabled:services.filter(item=>item.enabled).length,openremoteLinksChecked:true,wrongRealmDenied:true,viewerDenied:!!viewer,verifiedMailProfile:true});
  }
  console.log(JSON.stringify({readOnly:true,mailConfigured:true,organisations:results}));
}finally{await repository.close();}
