import test from 'node:test';import assert from 'node:assert/strict';
import {authoritativeSites,authoritativeTopology} from '../src/inventory.mjs';
import {OpenRemoteClient} from '../src/openremote-client.mjs';
function setup(){
 const site={id:'s',openremoteRealm:'r',openremoteSiteAssetId:'S',name:'Old Site'};
 const a=(id,kind,local,name,parentId,role)=>({id,realm:'r',name,parentId,attributes:{gridexResourceKind:{value:kind},gridexResourceId:{value:local},gridexSiteId:{value:'s'},gatewayRole:{value:role},hardwareModel:{value:'model'}}});
 const assets=[a('S','site','s','OR Site'),a('R','gateway','rock','OR ROCK','S','controller'),a('E','gateway','esp','OR ESP','R','device-node')];
 const local={configuration:{status:'draft'},gateways:[{id:'rock',name:'Old ROCK',ports:[{name:'OT'}]},{id:'esp',name:'Old ESP',ports:[]}],devices:[]};
 const bindings=[{gatewayId:'rock',assetId:'R'},{gatewayId:'esp',assetId:'E'}];
 const repository={getTopology:async()=>local,getGatewayBindings:async()=>bindings};
 const openRemote={getUserLinkedAssets:async(ids,subject)=>{assert.equal(subject,'owner');return assets.filter(a=>ids.includes(a.id));}};
 return {site,assets,local,bindings,repository,openRemote};
}
test('hardware names/model/roles from OR; local execution ports retained; no fake connectivity',async()=>{
 const x=setup();const result=await authoritativeTopology(x.site,x.repository,x.openRemote,'owner');
 assert.deepEqual(result.gateways.map(g=>g.name),['OR ROCK','OR ESP']);
 assert.equal(result.inventorySource,'openremote');assert.equal(result.gateways[0].ports[0].name,'OT');
 assert.equal(result.gateways[0].online,undefined);
});
for(const [name,mutate]of [
 ['missing Site binding',x=>x.site.openremoteSiteAssetId=null],
 ['missing gateway binding',x=>x.bindings.pop()],
 ['removed owner link or asset',x=>x.assets.pop()],
 ['foreign realm',x=>x.assets[1].realm='foreign'],
 ['wrong Site',x=>x.assets[1].attributes.gridexSiteId.value='other'],
 ['wrong parent',x=>x.assets[2].parentId='S'],
 ['local-only equipment',x=>x.local.devices.push({id:'unbound'})]
])test(name+' never falls back to local inventory',async()=>{const x=setup();mutate(x);await assert.rejects(authoritativeTopology(x.site,x.repository,x.openRemote,'owner'),e=>e.status===409);});
test('OR outage is 503, not login expiry or stale inventory',async()=>{
 const x=setup();x.openRemote.getUserLinkedAssets=async()=>{throw Error('down');};
 await assert.rejects(authoritativeTopology(x.site,x.repository,x.openRemote,'owner'),e=>e.status===503);
});
test('Site listing uses OR names, omits unbound and revoked resources',async()=>{
 const x=setup();assert.equal((await authoritativeSites([x.site,{id:'unbound'}],x.openRemote,'owner'))[0].name,'OR Site');
 x.assets.splice(0,1);assert.deepEqual(await authoritativeSites([x.site],x.openRemote,'owner'),[]);
});
test('OR query constrained to authenticated subject and explicit IDs',async()=>{
 const client=new OpenRemoteClient({});client.getServiceToken=async()=> 'service';
 client.queryAssets=async(query,token)=>{assert.deepEqual(query,{ids:['A'],userIds:['owner']});assert.equal(token,'service');return [];};
 await client.getUserLinkedAssets(['A'],'owner');
});
