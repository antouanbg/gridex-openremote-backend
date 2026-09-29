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
