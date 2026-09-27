import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDeviceSetup } from '../src/device-setup.mjs';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { MemoryRepository } from '../src/repository.mjs';
const topology={gateways:[{id:'rock',role:'controller'},{id:'esp',role:'device-node'}]};
const backend={kind:'backend',target:'backend',transport:'ethernet'};
const equipment={kind:'equipment',target:'deye-100kw',transport:'rs485'};
test('two roles supported; inputs normalized to draft and no provisioning secrets persisted',()=>{
 const result=validateDeviceSetup({devices:[{gatewayId:'rock',roles:[backend,{...equipment,target:'suntech-261'}],password:'discard'},{gatewayId:'esp',roles:[equipment]}]},topology);
 assert.equal(result.lifecycle,'draft');assert.equal(result.devices[0].roles.length,2);assert.equal(result.devices[0].password,undefined);
});
test('reject excess roles, foreign devices, duplicate targets and direct ESP backend',()=>{
 for(const item of [
 {gatewayId:'rock',roles:[backend,equipment,{...equipment,target:'suntech-261'}]},
 {gatewayId:'foreign',roles:[equipment]}, {gatewayId:'esp',roles:[backend]},
 {gatewayId:'rock',roles:[equipment,equipment]}, {gatewayId:'rock',roles:[]},
 {gatewayId:'esp',roles:[{...equipment,transport:'telnet'}]}
 ]) assert.throws(()=>validateDeviceSetup({devices:[item]},topology),{status:400});
});

test('HTTP setup persists draft with writes locked, revision and site/role checks',async()=>{
 const repository=new MemoryRepository({sites:[{id:'site',organisationId:'org',openremoteSiteAssetId:'or-site',openremoteRealm:'test'}],memberships:[{subject:'user',organisationId:'org',role:'administrator',allSites:true}],gatewayBindings:[{siteId:'site',gatewayId:'rock',assetId:'or-rock'},{siteId:'site',gatewayId:'esp',assetId:'or-esp'}]});
 repository.topologies.set('site',{configuration:null,gateways:[{id:'rock',role:'controller',name:'ROCK Pi',hardwareModel:'rock-pi-e',ports:[]},{id:'esp',role:'device-node',name:'ESP32',hardwareModel:'olimex-esp32-evb-ea-ind',ports:[]}],devices:[]});
 const attribute=value=>({value});
 const assets=[
  {id:'or-site',name:'Site',realm:'test',attributes:{gridexResourceKind:attribute('site'),gridexResourceId:attribute('site')}},
  {id:'or-rock',name:'ROCK Pi',realm:'test',parentId:'or-site',attributes:{gridexResourceKind:attribute('gateway'),gridexResourceId:attribute('rock'),gridexSiteId:attribute('site'),gatewayRole:attribute('controller'),hardwareModel:attribute('rock-pi-e')}},
  {id:'or-esp',name:'ESP32',realm:'test',parentId:'or-rock',attributes:{gridexResourceKind:attribute('gateway'),gridexResourceId:attribute('esp'),gridexSiteId:attribute('site'),gatewayRole:attribute('device-node'),hardwareModel:attribute('olimex-esp32-evb-ea-ind')}},
 ];
 const openRemote={getUserLinkedAssets:async ids=>assets.filter(asset=>ids.includes(asset.id))};
 const server=createServer(createApp({repository,authenticate:async()=>({subject:'user',emailVerified:true}),config:{allowedOrigins:new Set(),writesEnabled:false,maximumBodyBytes:4096},openRemote}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/v1/sites/';
 try {
  const options={method:'PUT',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify({confirmed:true,configuration:{devices:[{gatewayId:'esp',roles:[equipment]}]}})};
  assert.equal((await fetch(url+'site/device-setup',options)).status,200);
  assert.equal((await fetch(url+'site/device-setup',options)).status,412);
  const response=await fetch(url+'site/device-setup');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).configuration.lifecycle,'draft');
  assert.equal((await fetch(url+'foreign/device-setup')).status,404);
  repository.memberships[0].role='integrator';
  assert.equal((await fetch(url+'site/device-setup')).status,200);
  assert.equal((await fetch(url+'site/device-setup',{...options,headers:{...options.headers,'If-Match':'1'}})).status,200);
  repository.memberships[0].role='viewer';
  assert.equal((await fetch(url+'site/device-setup')).status,403);
  assert.equal((await fetch(url+'site/device-setup',{...options,headers:{...options.headers,'If-Match':'2'}})).status,403);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
