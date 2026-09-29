import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { MemoryRepository } from '../src/repository.mjs';
import { ApiError } from '../src/errors.mjs';

test('Site chart history is denied before service approval and requires exact OpenRemote Site link', async () => {
  const organisationId='11111111-1111-4111-8111-111111111111';
  const siteId='22222222-2222-4222-8222-222222222222';
  const repository=new MemoryRepository({sites:[{id:siteId,organisationId,openremoteRealm:'novacom',openremoteSiteAssetId:'or-site'}],
    memberships:[{subject:'viewer',organisationId,realm:'novacom',role:'viewer',allSites:true}]});
  let enabled=false,linked=true,reads=0;
  const openRemote={
    getUserLinkedAssets:async(ids,subject,context)=>{
      assert.equal(subject,'viewer');assert.equal(context.realm,'novacom');assert.equal(context.token,'user-token');
      return linked?ids.map(id=>id==='or-site'
        ? {id,realm:'novacom',name:'Test Site',attributes:{gridexResourceKind:{value:'site'},gridexResourceId:{value:siteId}}}
        : {id,realm:'novacom'}):[];
    },
    getDatapoints:async()=>{reads++;return [{x:Date.now()-60000,y:42}];},
  };
  const app=createApp({repository,openRemote,authenticate:async()=>({subject:'viewer',realm:'novacom',accessToken:'user-token',emailVerified:true}),
    serviceEntitlements:{requireSiteVisualisations:async()=>{if(!enabled)throw new ApiError(403,'service_not_enabled','Denied');}},
    config:{realm:'gridex',platformAdminSubjects:new Set(),allowedOrigins:new Set(),historyMaximumRangeMs:31*86400000,
      historyBindings:[{siteId,assetId:'or-rock',metric:'cpuTemperatureC'}]}});
  const server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/sites/${siteId}/visualisations/history`;
  try {
    assert.equal((await fetch(url)).status,403);assert.equal(reads,0);
    enabled=true;linked=false;
    assert.equal((await fetch(url)).status,403);assert.equal(reads,0);
    linked=true;
    const response=await fetch(url);
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    assert.equal((await response.json()).items[0].metric,'cpuTemperatureC');
    assert.equal(reads,1);
    assert.equal((await fetch(url.replace(siteId,'33333333-3333-4333-8333-333333333333'))).status,404);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
