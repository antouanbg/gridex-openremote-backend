import test from 'node:test';
import assert from 'node:assert/strict';
import { hourlyPrices, MarketStorage } from '../src/market-storage.mjs';

test('quarter-hour source is aggregated only when the complete UTC hour is present', () => {
  const points=[-10,0,20,30].map((price,index)=>({
    startUtc:new Date(Date.parse('2026-09-29T10:00:00Z')+index*900000).toISOString(),
    endUtc:new Date(Date.parse('2026-09-29T10:15:00Z')+index*900000).toISOString(),
    priceEurMwh:price,resolutionMinutes:15,
  }));
  assert.deepEqual(hourlyPrices(points), [{startUtc:'2026-09-29T10:00:00.000Z',
    priceEurMwh:10,sourceResolutionMinutes:15,sourceIntervalCount:4}]);
  assert.deepEqual(hourlyPrices(points.slice(1)), []);
});

test('historical read is parameterized and no fetch key enters the archive query', async () => {
  const seen=[];
  const storage=new MarketStorage(null,{pool:{query:async(sql,args)=>{seen.push({sql,args});return {rows:sql.includes('SELECT enabled')?[{enabled:true}]:[]};}}});
  assert.equal((await storage.prices({country:'BG',zone:'BG',date:'2026-09-29',service:'day_ahead'})).intervals.length,0);
  assert.deepEqual(seen[1].args,['BG','BG','2026-09-29']);
  await assert.rejects(storage.prices({country:'BG',zone:'BG;DROP',date:'2026-09-29',service:'day_ahead'}),
    error=>error.code==='market_query_invalid');
});

test('repeated hourly archive writes compare rounded prices, not floating-point noise', async () => {
  const seen=[];
  const db={query:async(sql,args)=>{seen.push({sql,args});return {rows:sql.includes('SELECT enabled')?[{enabled:true}]:[]};},release(){}};
  const storage=new MarketStorage(null,{pool:{connect:async()=>db}});
  await storage.save({status:'published',zone:'BG',country:'BG',date:'2026-09-29',
    sourceDocumentId:'document',fetchedAt:'2026-09-28T12:00:00Z',intervals:[{
      startUtc:'2026-09-29T10:00:00Z',endUtc:'2026-09-29T11:00:00Z',
      priceEurMwh:10.0000000001,resolutionMinutes:60,
    }]});
  const revision=seen.find(item=>item.sql.includes('INSERT INTO market_hourly_price_revisions'));
  assert.equal(revision.args[4],10);
  assert.match(revision.sql,/WHERE NOT EXISTS/);
});

test('only Bulgaria is enabled by the schema; disabled zones cannot be saved or read', async () => {
  const { readFileSync } = await import('node:fs');
  const { fileURLToPath } = await import('node:url');
  const schema=readFileSync(fileURLToPath(new URL('../market-schema.sql',import.meta.url)),'utf8');
  assert.match(schema,/VALUES \('BG','BG',true,'system:bulgaria-default'\)/);
  assert.doesNotMatch(schema,/VALUES \('(?:DE|FR|ES|IT)'/);
  const db={query:async(sql)=>({rows:sql.includes('SELECT enabled')?[{enabled:false}]:[]}),release(){}};
  const storage=new MarketStorage(null,{pool:{connect:async()=>db,query:db.query}});
  assert.equal((await storage.enabledZones()).length,0);
  assert.equal(await storage.save({status:'published',zone:'FR',intervals:[]}),0);
  await assert.rejects(storage.prices({country:'FR',zone:'FR',date:'2026-09-29',service:'day_ahead'}),
    error=>error.code==='market_zone_disabled');
});
