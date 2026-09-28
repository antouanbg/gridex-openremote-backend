import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createServer} from 'node:http';
import {MemoryRepository} from '../src/repository.mjs';
import {createApp} from '../src/app.mjs';

test('customer UI API creates a Site and ROCK in OpenRemote; wrong-realm writes fail closed',async()=>{
  const organisationId=randomUUID(),realm='customer-one',subject='customer-admin';
  const repository=new MemoryRepository({memberships:[{organisationId,realm,subject,role:'administrator',allSites:true}]});
  const principal={subject,realm,emailVerified:true,accessToken:'customer-token'};
  const assets=[],links=new Set();
  const remote={
    queryAssets:async()=>assets,
    createUserAsset:async asset=>{const saved={...asset,id:randomUUID()};assets.push(saved);return saved;},
    getUserLinkedAssets:async(ids,who)=>assets.filter(asset=>ids.includes(asset.id)&&links.has(`${who}:${asset.id}`)),
    linkUserAsset:async(id,who)=>{links.add(`${who}:${id}`);},
  };
  const app=createApp({repository,authenticate:async()=>principal,openRemote:remote,
    config:{realm:'gridex',allowedOrigins:new Set(),maximumBodyBytes:8192,writesEnabled:false}});
  const server=createServer(app);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/v1`;
  const post=async(path,body,key)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(body)});
  try{
    const siteResponse=await post('/sites',{organisationId,name:'Customer Site',timezone:'Europe/Sofia'},'customer-site-001');
    assert.equal(siteResponse.status,201);
    const site=await siteResponse.json();
    assert.equal((await (await fetch(base+'/sites')).json()).sites[0].id,site.id);
    const gatewayResponse=await post(`/sites/${site.id}/gateways`,{name:'ROCK',hardwareModel:'rock-pi-e'},'customer-rock-001');
    assert.equal(gatewayResponse.status,201);
    const gateway=await gatewayResponse.json();
    const topology=await (await fetch(`${base}/sites/${site.id}/hardware`)).json();
    assert.equal(topology.inventorySource,'openremote');
    assert.equal(topology.gateways[0].id,gateway.id);
    assert.equal(assets[1].parentId,assets[0].id);
    assert.equal((await post(`/sites/${site.id}/devices`,{type:'meter'},'customer-meter-001')).status,409);
    principal.realm='other-tenant';
    assert.equal((await post('/sites',{organisationId,name:'Wrong Realm',timezone:'Europe/Sofia'},'customer-site-002')).status,403);
    assert.equal(assets.length,2);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
