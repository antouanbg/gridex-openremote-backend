import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {MemoryRepository} from '../src/repository.mjs';
import {provisionSite,provisionGateway,validateGatewayInput} from '../src/inventory-provisioning.mjs';

function setup(){
  const organisationId=randomUUID(),subject='customer-admin',realm='customer-one';
  const repository=new MemoryRepository({memberships:[{organisationId,subject,role:'administrator',allSites:true,realm}]});
  const principal={subject,realm,emailVerified:true,accessToken:'customer-token'};
  const assets=[],links=new Set();let creates=0,failLink=false;
  const remote={
    queryAssets:async()=>assets,
    getAsset:async id=>assets.find(asset=>asset.id===id)||null,
    createUserAsset:async(asset,token,targetRealm)=>{assert.equal(token,'customer-token');assert.equal(targetRealm,realm);assert.equal(asset.attributes.notes?.type,'text');assert.ok(asset.attributes.notes?.value);const saved={...asset,id:randomUUID()};assets.push(saved);creates++;return saved;},
    getUserLinkedAssets:async(ids,who)=>assets.filter(asset=>ids.includes(asset.id)&&links.has(`${who}:${asset.id}`)),
    linkUserAsset:async(id,who)=>{if(failLink)throw Error('OpenRemote link unavailable');links.add(`${who}:${id}`);},
  };
  return {organisationId,repository,principal,remote,assets,links,get creates(){return creates;},set failLink(value){failLink=value;}};
}

test('customer administrator provisions an OpenRemote Site before local projection; retry is idempotent',async()=>{
  const env=setup(),input={organisationId:env.organisationId,name:'Customer Site',timezone:'Europe/Sofia'};
  const site=await provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-001',input});
  assert.equal(site.openremoteRealm,env.principal.realm);
  assert.equal(env.assets[0].attributes.gridexResourceId.value,site.id);
  assert.equal(env.assets[0].attributes.notes.value,'GrideX Site');
  for(const name of ['notes','location'])assert.deepEqual(env.assets[0].attributes[name].meta,{readRestricted:true,writeRestricted:false});
  for(const name of ['gridexResourceId','gridexResourceKind','gridexSiteId'])assert.deepEqual(env.assets[0].attributes[name].meta,{});
  assert.equal(env.assets[0].id,site.openremoteSiteAssetId);
  assert.equal(env.repository.sites.length,1);
  const retry=await provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-001',input});
  assert.equal(retry.id,site.id);assert.equal(env.creates,1);
  env.links.clear();
  await assert.rejects(provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-001',input}),{code:'inventory_link_unverified'});
});

test('OpenRemote owner-link failure leaves no Site and a retry reconciles the same asset',async()=>{
  const env=setup(),input={organisationId:env.organisationId,name:'Pending Site',timezone:'Europe/Sofia'};
  env.failLink=true;
  await assert.rejects(provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-002',input}));
  assert.equal(env.repository.sites.length,0);
  env.failLink=false;
  const site=await provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-002',input});
  assert.equal(env.creates,1);assert.equal(site.openremoteSiteAssetId,env.assets[0].id);
});

test('SQL projection failure after OpenRemote creation recovers the same asset on retry',async()=>{
  const env=setup(),input={organisationId:env.organisationId,name:'Retry Site',timezone:'Europe/Sofia'};
  const complete=env.repository.completeSiteIntent.bind(env.repository);let fail=true;
  env.repository.completeSiteIntent=async(...args)=>{if(fail){fail=false;throw Error('database unavailable');}return complete(...args);};
  await assert.rejects(provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-005',input}));
  assert.equal(env.repository.sites.length,0);
  const site=await provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,key:'customer-site-005',input});
  assert.equal(env.creates,1);assert.equal(site.openremoteSiteAssetId,env.assets[0].id);
});

test('only approved ROCK then ESP can be added inside the same customer Site',async()=>{
  const env=setup(),site=await provisionSite({repository:env.repository,remote:env.remote,principal:env.principal,
    key:'customer-site-003',input:{organisationId:env.organisationId,name:'Site',timezone:'Europe/Sofia'}});
  const rock=await provisionGateway({repository:env.repository,remote:env.remote,principal:env.principal,site,key:'customer-rock-001',
    input:{name:'ROCK Pi E',hardwareModel:'rock-pi-e'}});
  assert.equal(rock.role,'controller');
  assert.equal(env.assets[1].attributes.notes.value,'GrideX gateway');
  const rockRetry=await provisionGateway({repository:env.repository,remote:env.remote,principal:env.principal,site,key:'customer-rock-001',
    input:{name:'ROCK Pi E',hardwareModel:'rock-pi-e'}});
  assert.equal(rockRetry.id,rock.id);
  const esp=await provisionGateway({repository:env.repository,remote:env.remote,principal:env.principal,site,key:'customer-esp-001',
    input:{name:'ESP32',hardwareModel:'olimex-esp32-evb-ea-ind',parentGatewayId:rock.id}});
  assert.equal(esp.role,'device-node');
  assert.equal(env.assets[2].parentId,env.assets[1].id);
  assert.equal(env.repository.gatewayBindings.length,2);
  assert.throws(()=>validateGatewayInput({name:'Other',hardwareModel:'arbitrary-device'}),{code:'unsupported_gateway'});
});

test('non-admin and wrong-realm identities cannot provision a Site',async()=>{
  const env=setup(),input={organisationId:env.organisationId,name:'No Access',timezone:'Europe/Sofia'};
  await assert.rejects(provisionSite({repository:env.repository,remote:env.remote,principal:{...env.principal,subject:'viewer'},key:'customer-site-004',input}),{code:'permission_denied'});
  await assert.rejects(provisionSite({repository:env.repository,remote:env.remote,principal:{...env.principal,realm:'foreign'},key:'customer-site-004',input}),{code:'permission_denied'});
  assert.equal(env.assets.length,0);
});
