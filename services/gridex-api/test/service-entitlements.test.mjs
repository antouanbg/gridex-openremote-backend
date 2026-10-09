import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceEntitlements } from '../src/service-entitlements.mjs';

const organisationId='11111111-1111-4111-8111-111111111111';
const config={realm:'gridex',platformAdminSubjects:new Set(['owner'])};
const platform={subject:'owner',realm:'gridex',emailVerified:true,permissions:['platform:manage']};
const member={subject:'customer',realm:'novacom',emailVerified:true,permissions:['platform:manage']};

test('only verified allowlisted pilot identity can administer the service catalogue',async()=>{
  const grants=new ServiceEntitlements({query:async()=>({rows:[{code:'day_ahead'}]})},config);
  await assert.rejects(grants.catalog(member),error=>error.code==='permission_denied');
  await assert.rejects(grants.catalog({...platform,emailVerified:false}),error=>error.code==='permission_denied');
  assert.deepEqual(await grants.catalog(platform),[{code:'day_ahead'}]);
});

test('organisation enablement never grants a member automatically',async()=>{
  const sql=[];
  const db={query:async(query)=>{sql.push(query);return {rows:[{id:organisationId,status:'active',requestable:true}]};},release(){}};
  const grants=new ServiceEntitlements({query:db.query,connect:async()=>db},config);
  await grants.setOrganisation(platform,organisationId,'day_ahead',true);
  assert.equal(sql.some(query=>query.includes('INSERT INTO member_services')),false);
  sql.length=0;
  await grants.setOrganisation(platform,organisationId,'day_ahead',false);
  assert.equal(sql.some(query=>query.includes('DELETE FROM organisation_services')),true);
});

test('market zone grants require platform identity and day-ahead organisation grant',async()=>{
  const sql=[];
  const db={query:async(query)=>{sql.push(query);return {rows:query.includes('FROM organisations WHERE id=$1')
    ?[{status:'active'}]:[]};},release(){}};
  const grants=new ServiceEntitlements({query:db.query,connect:async()=>db},config);
  await assert.rejects(grants.setOrganisationMarketZone(member,organisationId,'BG','BG',true),
    error=>error.code==='permission_denied');
  await assert.rejects(grants.setOrganisationMarketZone(platform,organisationId,'BG','BG',true),
    error=>error.code==='service_not_enabled');
  assert.equal(sql.some(query=>query.includes('INSERT INTO organisation_market_zones')),false);
  await assert.rejects(grants.setOrganisationMarketZone(platform,organisationId,'FR','bogus',true),
    error=>error.code==='market_zone_invalid');
});

test('Site charts require both current organisation and member visualisations grants',async()=>{
  const calls=[];
  const pool={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]};}};
  const grants=new ServiceEntitlements(pool,config);
  await assert.rejects(grants.requireSiteVisualisations(member,organisationId),error=>error.code==='service_not_enabled');
  assert.match(calls[0].sql,/organisation_services s/);
  assert.match(calls[0].sql,/member_services g/);
  assert.match(calls[0].sql,/o\.openremote_realm=\$3 AND o\.status='active'/);
  assert.deepEqual(calls[0].args,[organisationId,member.subject,member.realm]);
  await grants.requireSiteVisualisations(platform,organisationId);
  assert.equal(calls.length,1,'verified allowlisted platform identity may use an already-authorised Site');
  await assert.rejects(grants.requireSiteVisualisations({...platform,emailVerified:false},organisationId),
    error=>error.code==='service_not_enabled');
});

test('Site visualisation denial identifies each grant level without granting access',async()=>{
  for(const [organisationEnabled,memberEnabled] of [[false,false],[false,true],[true,false],[true,true]]){
    const grants=new ServiceEntitlements({query:async()=>({rows:[{organisationEnabled,memberEnabled}]})},config);
    if(organisationEnabled&&memberEnabled)await grants.requireSiteVisualisations(member,organisationId);
    else await assert.rejects(grants.requireSiteVisualisations(member,organisationId),error=>{
      assert.equal(error.status,403);
      assert.deepEqual(error.details,{missing:organisationEnabled?'member':'organisation',organisationEnabled,memberEnabled});
      return true;
    });
  }
  const grants=new ServiceEntitlements({query:async()=>({rows:[]})},config);
  await assert.rejects(grants.requireSiteVisualisations(member,organisationId),error=>error.details===undefined);
});
