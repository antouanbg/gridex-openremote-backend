import{test}from'node:test';import assert from'node:assert/strict';
import{parseTemperature,validateHistoryBindings,enqueueMeasurement}from'../src/history-ingest.mjs';
const b={siteId:'10000000-0000-0000-0000-000000000001',gatewayId:'20000000-0000-0000-0000-000000000001',assetId:'1234567890123456789012',sourceGateway:'test-rock',topic:'gridex/v1/sites/test/edge/test-rock/health',metric:'cpuTemperatureC'};
const now=Date.now(),base={schemaVersion:1,gatewayId:b.sourceGateway,observedAt:new Date(now).toISOString(),cpuTemperatureC:48.125};
const parse=(x,options={})=>parseTemperature(b.topic,Buffer.from(JSON.stringify(x)),b,{now,...options});
test('temperature accepts only real numeric fresh source readings',()=>{
 assert.equal(parse(base).value,48.125);assert.equal(parse({...base,cpuTemperatureC:0}).value,0);
 for(const value of [undefined,null,'48',151,-41])assert.equal(parse({...base,cpuTemperatureC:value}),null);
 assert.equal(parse(base,{retained:true}),null);assert.equal(parse({...base,gatewayId:'other'}),null);
 assert.equal(parse({...base,observedAt:new Date(now-121000).toISOString()}),null);
 assert.equal(parse({...base,observedAt:new Date(now+6000).toISOString()}),null);
});
test('bindings reject wildcard topics and unsupported sensor mappings',()=>{
 assert.equal(validateHistoryBindings([b]).length,1);
 assert.throws(()=>validateHistoryBindings([{...b,topic:'gridex/#/health'}]));
 assert.throws(()=>validateHistoryBindings([{...b,metric:'socPct'}]));
 assert.throws(()=>validateHistoryBindings([b,b]));
});
test('durable intake is inventory scoped and deduplicated',async()=>{
 let call;const pool={query:async(...args)=>{call=args;return{rowCount:1}}};
 assert.equal(await enqueueMeasurement(pool,parse(base)),true);
 assert.match(call[0],/g.site_id=\$2/);assert.match(call[0],/ON CONFLICT/);assert.equal(call[1][5],48.125);
 assert.equal(await enqueueMeasurement(pool,null),false);
});
