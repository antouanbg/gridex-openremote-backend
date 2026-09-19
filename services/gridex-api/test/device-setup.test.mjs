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

test('HTTP setup persists draft with writes locked, revision and site/admin checks',async()=>{
 const repository=new MemoryRepository({sites:[{id:'site',organisationId:'org'}],memberships:[{subject:'user',organisationId:'org',role:'administrator',allSites:true}]});
 repository.topologies.set('site',topology);
 const server=createServer(createApp({repository,authenticate:async()=>({subject:'user',emailVerified:true}),config:{allowedOrigins:new Set(),writesEnabled:false,maximumBodyBytes:4096},openRemote:{}}));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/api/v1/sites/';
 try {
  const options={method:'PUT',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify({confirmed:true,configuration:{devices:[{gatewayId:'esp',roles:[equipment]}]}})};
  assert.equal((await fetch(url+'site/device-setup',options)).status,200);
  assert.equal((await fetch(url+'site/device-setup',options)).status,412);
  const response=await fetch(url+'site/device-setup');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal((await response.json()).configuration.lifecycle,'draft');
  assert.equal((await fetch(url+'foreign/device-setup')).status,404);
  repository.memberships[0].role='viewer';
  assert.equal((await fetch(url+'site/device-setup')).status,403);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
