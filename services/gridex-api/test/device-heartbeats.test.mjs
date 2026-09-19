import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { parseHeartbeat, heartbeatStatuses, DeviceHeartbeats } from '../src/device-heartbeats.mjs';
import { createApp } from '../src/app.mjs';
import { MemoryRepository } from '../src/repository.mjs';
const now = Date.parse('2026-09-19T19:12:00Z');
const binding = { prefix:'gridex/v1',site:'test',gateway:'rock',siteId:'site',gatewayId:'rock-id',nodes:{1:'esp-id'} };
const base = 'gridex/v1/sites/test/edge/rock';
const message = {schemaVersion:1,observedAt:new Date(now).toISOString(),gatewayId:'rock'};
const parse = (data = message,topic = `${base}/health`,options = {}) => parseHeartbeat(topic,Buffer.from(JSON.stringify(data)),binding,{now,...options});
test('ROCK heartbeat independent of PCS/battery lock; retained and old messages do not refresh liveness',()=>{
  assert.equal(parse({...message,pcsHeartbeatOk:false,controlReady:false}).online,true);
  assert.throws(()=>parse(message,undefined,{retained:true}));
  assert.throws(()=>parse({...message,observedAt:new Date(now-121000).toISOString()}));
  assert.throws(()=>parse({...message,observedAt:new Date(now+6000).toISOString()}));
  assert.throws(()=>parse({...message,gatewayId:'other'}));
  assert.throws(()=>parse(message,'gridex/v1/sites/foreign/edge/rock/health'));
});
test('ESP successful contact uses actual poll timestamp; legacy publisher remains unknown',()=>{
  const node={...message,slot:1,online:true,pollStatus:1,heartbeat:695,lastSuccessfulContactAt:new Date(now-10000).toISOString()};
  const item=parse(node,`${base}/nodes/1/telemetry`);
  assert.equal(item.gatewayId,'esp-id');
  assert.equal(item.lastSuccessfulContactAt,node.lastSuccessfulContactAt);
  assert.equal(parse({...node,lastSuccessfulContactAt:null},`${base}/nodes/1/telemetry`).lastSuccessfulContactAt,null);
  assert.throws(()=>parse({...node,slot:2},`${base}/nodes/1/telemetry`));
  assert.throws(()=>parse({...node,lastSuccessfulContactAt:new Date(now+1000).toISOString()},`${base}/nodes/1/telemetry`));
});
test('independent source/node ageing; missing source cannot imply online ESP',()=>{
  const rock={...parse(),receivedAt:message.observedAt};
  const node={gatewayId:'esp-id',sourceGatewayId:'rock-id',observedAt:message.observedAt,online:true,lastSuccessfulContactAt:new Date(now-40000).toISOString()};
  assert.deepEqual(heartbeatStatuses([rock,node],now).map(x=>x.status),['online','stale']);
  assert.equal(heartbeatStatuses([node],now)[0].status,'unknown');
  assert.equal(heartbeatStatuses([rock],now+100000)[0].status,'offline');
  assert.equal(heartbeatStatuses([rock,{...node,online:false}],now)[1].status,'offline');
  assert.equal(heartbeatStatuses([rock,{...node,lastSuccessfulContactAt:null}],now)[1].status,'unknown');
});
test('persistent write is inventory scoped and monotonically ordered, no payload interpolation',async()=>{
  let captured;
  const store = new DeviceHeartbeats({query:async(sql,args)=>{captured={sql,args};return{rowCount:1};}});
  assert.equal(await store.accept(parse()),true);
  assert.match(captured.sql,/device_heartbeats.observed_at < EXCLUDED.observed_at/);
  assert.match(captured.sql,/s.site_id=g.site_id/);
  assert.equal(captured.args[0],'rock-id');
});
test('HTTP requires verified administrator and Site scope; empty is not demo',async()=>{
  const repository=new MemoryRepository({sites:[{id:'site',organisationId:'org'}],memberships:[{subject:'user',organisationId:'org',role:'administrator',allSites:true}]});
  let reads=0;
  const server=createServer(createApp({repository,authenticate:async()=>({subject:'user',emailVerified:true}),
    config:{allowedOrigins:new Set()},openRemote:{},deviceHeartbeats:{list:async(site)=>{assert.equal(site,'site');reads++;return [];}}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/sites/`;
  try {
    const response=await fetch(url+'site/device-heartbeats');
    assert.equal(response.status,200); assert.equal(response.headers.get('cache-control'),'no-store');
    assert.deepEqual(await response.json(),{items:[]});
    assert.equal((await fetch(url+'foreign/device-heartbeats')).status,404);
    repository.memberships[0].role='viewer';
    assert.equal((await fetch(url+'site/device-heartbeats')).status,403);
    assert.equal(reads,1);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
