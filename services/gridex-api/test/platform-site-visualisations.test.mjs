import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createApp} from '../src/app.mjs';
import {MemoryRepository} from '../src/repository.mjs';
import {ServiceEntitlements} from '../src/service-entitlements.mjs';

test('platform charts retain service privilege but require Site and measurement links',async()=>{
  const org='11111111-1111-4111-8111-111111111111',siteId='22222222-2222-4222-8222-222222222222';
  const config={realm:'gridex',platformAdminSubjects:new Set(['owner']),allowedOrigins:new Set(),historyMaximumRangeMs:86400000,
    historyBindings:[{siteId,assetId:'sensor',metric:'cpuTemperatureC'}]};
  const repository=new MemoryRepository({sites:[{id:siteId,organisationId:org,openremoteRealm:'gridex',openremoteSiteAssetId:'or-site'}],
    memberships:[{subject:'owner',organisationId:org,realm:'gridex',role:'administrator',allSites:true}]});
  let siteLinked=true,sensorLinked=true,reads=0;
  const openRemote={getUserLinkedAssets:async(ids,subject,context)=>{
    assert.equal(subject,'owner');assert.equal(context.realm,'gridex');
    return ids.flatMap(id=>id==='or-site'?(siteLinked?[{id,name:'Test Site',realm:'gridex',attributes:{gridexResourceKind:{value:'site'},gridexResourceId:{value:siteId}}}]:[]):sensorLinked?[{id,realm:'gridex'}]:[]);
  },getDatapoints:async()=>{reads++;return [{x:Date.now()-1000,y:40}];}};
  const serviceEntitlements=new ServiceEntitlements({query:async()=>({rows:[]})},config);
  const server=createServer(createApp({repository,openRemote,serviceEntitlements,config,
    authenticate:async()=>({subject:'owner',realm:'gridex',emailVerified:true,accessToken:'fixture'})}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/sites/${siteId}/visualisations/history`;
  try{
    assert.equal((await fetch(url)).status,200);assert.equal(reads,1);
    siteLinked=false;assert.equal((await fetch(url)).status,403);assert.equal(reads,1);
    siteLinked=true;sensorLinked=false;const res=await fetch(url);assert.equal(res.status,200);
    assert.deepEqual((await res.json()).items,[]);assert.equal(reads,1);
    assert.equal((await fetch(url.replace(siteId,'33333333-3333-4333-8333-333333333333'))).status,404);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
