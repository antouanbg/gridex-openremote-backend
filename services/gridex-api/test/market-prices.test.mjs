import test from 'node:test';
import assert from 'node:assert/strict';
import { DayAheadMarket, parseDayAheadXml } from '../src/market-prices.mjs';
import { createApp } from '../src/app.mjs';
import { MemoryRepository } from '../src/repository.mjs';
import { ApiError } from '../src/errors.mjs';
import { createServer } from 'node:http';

const xml = (curve = 'A01', points = '<Point><position>1</position><price.amount>-12.5</price.amount></Point><Point><position>2</position><price.amount>42</price.amount></Point>') => `
<Publication_MarketDocument><mRID>published-1</mRID><TimeSeries>
<contract_MarketAgreement.type>A01</contract_MarketAgreement.type><currency_Unit.name>EUR</currency_Unit.name>
<price_Measure_Unit.name>MWH</price_Measure_Unit.name><curveType>${curve}</curveType><Period>
<timeInterval><start>2026-09-29T00:00Z</start><end>2026-09-29T00:30Z</end></timeInterval>
<resolution>PT15M</resolution>${points}</Period></TimeSeries></Publication_MarketDocument>`;

test('A44 parsing preserves negative 15-minute prices and UTC intervals', () => {
  const data = parseDayAheadXml(xml());
  assert.equal(data.documentId, 'published-1');
  assert.deepEqual(data.intervals.map(item => item.priceEurMwh), [-12.5, 42]);
  assert.equal(data.intervals[1].startUtc, '2026-09-29T00:15:00.000Z');
});

test('A03 step curves fill intermediate positions; incomplete A01 is rejected', () => {
  const points = '<Point><position>1</position><price.amount>7</price.amount></Point>';
  assert.deepEqual(parseDayAheadXml(xml('A03', points)).intervals.map(item => item.priceEurMwh), [7, 7]);
  assert.throws(() => parseDayAheadXml(xml('A01', points)), error => error.code === 'market_incomplete');
});

test('acknowledgement is not misrepresented as zero prices', () => {
  assert.equal(parseDayAheadXml('<Acknowledgement_MarketDocument/>').status, 'not_published');
});

test('identical ENTSO-E duplicate series are deduplicated but conflicting prices fail closed', () => {
  const duplicate = xml().replace('</Publication_MarketDocument>',
    `<TimeSeries><contract_MarketAgreement.type>A01</contract_MarketAgreement.type>
    <currency_Unit.name>EUR</currency_Unit.name><price_Measure_Unit.name>MWH</price_Measure_Unit.name>
    <curveType>A01</curveType><Period><timeInterval><start>2026-09-29T00:00Z</start>
    <end>2026-09-29T00:30Z</end></timeInterval><resolution>PT15M</resolution>
    <Point><position>1</position><price.amount>-12.5</price.amount></Point>
    <Point><position>2</position><price.amount>42</price.amount></Point>
    </Period></TimeSeries></Publication_MarketDocument>`);
  assert.equal(parseDayAheadXml(duplicate).intervals.length, 2);
  assert.throws(() => parseDayAheadXml(duplicate.replace('<price.amount>42</price.amount></Point>\n    </Period>',
    '<price.amount>43</price.amount></Point>\n    </Period>')),
  error => error.code === 'market_invalid_response');
});

test('day-ahead sequence 2 never overrides the primary auction sequence', () => {
  const primary = xml().replace('<curveType>A01</curveType>',
    '<classificationSequence_AttributeInstanceComponent.position>1</classificationSequence_AttributeInstanceComponent.position><curveType>A01</curveType>');
  const secondary = primary.match(/<TimeSeries>[\s\S]*?<\/TimeSeries>/)[0]
    .replace('<classificationSequence_AttributeInstanceComponent.position>1</classificationSequence_AttributeInstanceComponent.position>',
      '<classificationSequence_AttributeInstanceComponent.position>2</classificationSequence_AttributeInstanceComponent.position>')
    .replace('<price.amount>42</price.amount>', '<price.amount>99</price.amount>');
  const result = parseDayAheadXml(primary.replace('</Publication_MarketDocument>', `${secondary}</Publication_MarketDocument>`));
  assert.deepEqual(result.intervals.map(item => item.priceEurMwh), [-12.5,42]);
});

test('market validates zone and caches concurrent requests without exposing token', async () => {
  let requests = 0;
  const market = new DayAheadMarket({ token: 'secret-test-token', now: () => Date.parse('2026-09-29T12:00:00Z'),
    fetcher: async url => { requests++; assert.match(url, /documentType=A44/); return { ok: true, text: async () => xml() }; } });
  const query = { country: 'BG', zone: 'BG', date: '2026-09-29', service: 'day_ahead' };
  const [first, second] = await Promise.all([market.prices(query), market.prices(query)]);
  assert.equal(requests, 1);
  assert.deepEqual(first, second);
  assert.equal(first.intervals[0].priceEurMwh, -12.5);
  assert.equal(first.status, 'partial');
  assert.equal(JSON.stringify(first).includes('secret-test-token'), false);
  assert.equal((await market.prices(query)).intervals.length, 2);
  assert.equal(requests, 1);
  await assert.rejects(market.prices({ ...query, zone: 'evil' }), error => error.code === 'market_zone_invalid');
  await assert.rejects(market.prices({ ...query, service: 'intraday' }), error => error.code === 'market_service_unsupported');
  await assert.rejects(market.prices({ ...query, date: 'invalid' }), error => error.code === 'market_date_invalid');
});

test('market archive and status are platform-only, never return the provider token', async () => {
  const repository = new MemoryRepository({ memberships: [{ subject: 'member', organisationId: 'org', role: 'viewer', allSites: true }] });
  const market = new DayAheadMarket({ token: 'secret-test-token', now: () => Date.parse('2026-09-29T12:00:00Z'),
    fetcher: async () => ({ ok: true, text: async () => xml() }) });
  const app = createApp({ config: { realm: 'gridex', allowedOrigins: new Set(), platformAdminSubjects: new Set(['owner']) },
    authenticate: async request => {
      if (!request.headers.authorization) throw new ApiError(401, 'authentication_required', 'Sign in.');
      return { subject: request.headers.authorization === 'Bearer member' ? 'member' : request.headers.authorization === 'Bearer owner' ? 'owner' : 'stranger',
        realm: 'gridex', emailVerified: true, roles: [], permissions: [] };
    }, repository, openRemote: { health: async () => true }, market,
    serviceEntitlements: { platform(principal) {
      if (principal.subject !== 'owner') throw new ApiError(403, 'permission_denied', 'Platform administrator required.');
    } } });
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    assert.equal((await fetch(`${base}/api/v1/market/services`)).status, 401);
    assert.equal((await fetch(`${base}/api/v1/market/services`, { headers: { Authorization: 'Bearer stranger' } })).status, 403);
    assert.equal((await fetch(`${base}/api/v1/market/prices?country=BG&zone=BG&date=2026-09-29&service=day_ahead`,
      { headers: { Authorization: 'Bearer member' } })).status, 403);
    const catalog = await fetch(`${base}/api/v1/market/services`, { headers: { Authorization: 'Bearer owner' } });
    assert.equal(catalog.status, 200);
    assert.equal((await catalog.json()).services[0].id, 'day_ahead');
    const prices = await fetch(`${base}/api/v1/market/prices?country=BG&zone=BG&date=2026-09-29&service=day_ahead`,
      { headers: { Authorization: 'Bearer owner' } });
    assert.equal(prices.status, 200);
    assert.equal((await prices.text()).includes('secret-test-token'), false);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('country collection and organisation zone administration require the platform identity', async () => {
  const repository=new MemoryRepository();
  const changes=[];
  const market={
    collectionZones:async()=>[{country:'BG',zone:'BG',enabled:true},{country:'FR',zone:'FR',enabled:false}],
    isZoneEnabled:async(country,zone)=>country==='BG'&&zone==='BG',
    setCollectionZone:async(country,zone,enabled,subject)=>{changes.push({country,zone,enabled,subject});return {country,zone,enabled};},
  };
  const entitlements={
    platform(principal){if(principal.subject!=='owner')throw new ApiError(403,'permission_denied','Platform administrator required.');},
    listOrganisationMarketZones:async()=>[],
    setOrganisationMarketZone:async()=>{throw new Error('disabled collection must fail first');},
  };
  const app=createApp({config:{realm:'gridex',allowedOrigins:new Set(),maximumBodyBytes:1024},
    authenticate:async req=>{
      if(!req.headers.authorization)throw new ApiError(401,'authentication_required','Sign in.');
      return {subject:req.headers.authorization==='Bearer owner'?'owner':'member',realm:'gridex',emailVerified:true,
        roles:[],permissions:[]};
    },repository,openRemote:{health:async()=>true},market,serviceEntitlements:entitlements});
  const server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const route=`${base}/api/v1/platform/market/zones`;
    assert.equal((await fetch(route)).status,401);
    assert.equal((await fetch(route,{headers:{Authorization:'Bearer member'}})).status,403);
    const response=await fetch(route,{headers:{Authorization:'Bearer owner'}});
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).zones.map(zone=>zone.enabled),[true,false]);
    const org=`${base}/api/v1/platform/organisations/11111111-1111-4111-8111-111111111111/market-zones/FR`;
    assert.equal((await fetch(org,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},
      body:JSON.stringify({country:'FR',enabled:true})})).status,403);
    assert.equal(changes.length,0);
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('fall DST day keeps 25 distinct UTC hours in Bulgaria', async () => {
  const points = Array.from({ length: 25 }, (_, index) => `<Point><position>${index + 1}</position><price.amount>${index}</price.amount></Point>`).join('');
  const document = `<Publication_MarketDocument><mRID>dst-25</mRID><TimeSeries>
    <contract_MarketAgreement.type>A01</contract_MarketAgreement.type><currency_Unit.name>EUR</currency_Unit.name>
    <price_Measure_Unit.name>MWH</price_Measure_Unit.name><curveType>A01</curveType><Period>
    <timeInterval><start>2026-10-24T21:00Z</start><end>2026-10-25T22:00Z</end></timeInterval>
    <resolution>PT60M</resolution>${points}</Period></TimeSeries></Publication_MarketDocument>`;
  const market = new DayAheadMarket({ token: 'fixture', now: () => Date.parse('2026-10-25T12:00:00Z'),
    fetcher: async () => ({ ok: true, text: async () => document }) });
  const result = await market.prices({ country: 'BG', zone: 'BG', date: '2026-10-25', service: 'day_ahead' });
  assert.equal(result.status, 'published');
  assert.equal(result.intervals.length, 25);
  assert.equal(new Set(result.intervals.map(item => item.startUtc)).size, 25);
});
