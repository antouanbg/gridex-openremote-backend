import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { GrafanaLaunch } from '../src/grafana-launch.mjs';
import { grafanaTimeRange } from '../src/grafana-range.mjs';
import { createApp } from '../src/app.mjs';

const subject='11111111-1111-4111-8111-111111111111';
const organisationId='22222222-2222-4222-8222-222222222222';
const config={realm:'gridex',platformAdminSubjects:new Set([subject])};
const market={isZoneEnabled:async(country,zone)=>country==='BG'&&zone==='BG'};

test('BG dashboard distinguishes native delivery intervals from fetch time without broader data access',()=>{
  const dashboard=JSON.parse(readFileSync(new URL('../../../observability/grafana/dashboards/gridex-market-bg.json',import.meta.url),'utf8'));
  assert.equal(dashboard.timezone,'Europe/Sofia');
  const explanation=dashboard.panels.find(panel=>panel.id===3);
  const delivery=dashboard.panels.find(panel=>panel.id===4);
  assert.match(explanation.options.content,/Ден напред/);
  assert.match(explanation.options.content,/предходния ден/);
  assert.match(delivery.targets[0].rawSql,/MAX\(start_utc\).*grafana_bg_interval_prices/);
  assert.match(delivery.targets[0].rawSql,/to_char\(.*Europe\/Sofia/);
  assert.match(dashboard.panels.find(panel=>panel.id===2).targets[0].rawSql,/to_char\(.*last_success_at.*Europe\/Sofia/);
  assert.deepEqual(dashboard.time,{from:'now-24h',to:'now+36h'});
  assert.match(explanation.options.content,/15 минути/);
  for(const panel of dashboard.panels)
    for(const target of panel.targets||[])
      assert.doesNotMatch(target.rawSql,/FROM\s+market_(?:hourly|interval)_prices\b/i);
});

test('embedded dashboard periods are allowlisted and custom BG delivery days handle DST',()=>{
  const params = value=>new URLSearchParams(value);
  assert.deepEqual(grafanaTimeRange(params('range=delivery')),{from:'now-24h',to:'now+36h'});
  assert.deepEqual(grafanaTimeRange(params('range=week')),{from:'now-7d',to:'now'});
  const autumn=grafanaTimeRange(params('range=custom&fromDay=2026-10-24&toDay=2026-10-25'));
  assert.equal(new Date(Number(autumn.from)).toISOString(),'2026-10-23T21:00:00.000Z');
  assert.equal(new Date(Number(autumn.to)).toISOString(),'2026-10-25T22:00:00.000Z');
  for(const invalid of ['range=../../manager','range=custom&fromDay=2026-02-30&toDay=2026-03-01',
    'range=custom&fromDay=2026-10-26&toDay=2026-10-25',
    'range=custom&fromDay=2026-01-01&toDay=2026-02-01',
    'range=custom&fromDay=2026-01-01&toDay=2026-03-01'])
    assert.throws(()=>grafanaTimeRange(params(invalid)),error=>error.code==='grafana_range_invalid');
});

test('public proxy forwards the validated period with the one-time Grafana ticket',()=>{
  const proxy=readFileSync(new URL('../../../deploy/public-https/nginx.conf.template',import.meta.url),'utf8');
  assert.match(proxy,/location = \/grafana\/launch \{[\s\S]*?proxy_pass http:\/\/\$api_backend\/internal\/grafana\/consume\?\$args;/);
  assert.doesNotMatch(proxy,/grafana\/consume\?ticket=\$arg_ticket/);
});

test('Grafana launch redirect keeps kiosk protection and applies a validated chart range',async()=>{
  let consumes=0;
  const server=createServer(createApp({config:{allowedOrigins:new Set(),grafanaPublicOrigin:'https://api.example.invalid'},
    grafanaLaunch:{consume:async()=>{consumes++;return {cookie:'fixture-cookie'};}}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const invalid=await fetch(`${base}/internal/grafana/consume?ticket=fixture&range=../../manager`,{redirect:'manual'});
    assert.equal(invalid.status,400);
    assert.equal(consumes,0);
    const response=await fetch(`${base}/internal/grafana/consume?ticket=fixture&range=week`,{redirect:'manual'});
    assert.equal(response.status,303);
    const target=new URL(response.headers.get('location'));
    assert.equal(target.origin,'https://api.example.invalid');
    assert.equal(target.pathname,'/grafana/d/gridex-market-bg/gridex-market-bg');
    assert.equal(target.searchParams.has('kiosk'),true);
    assert.equal(target.searchParams.get('from'),'now-7d');
    assert.equal(target.searchParams.get('to'),'now');
    assert.equal(consumes,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('dashboard launch requires two member services and BG zone, never one grant',async()=>{
  const sql=[];
  const pool={query:async(query)=>{
    sql.push(query);
    if(query.includes('SELECT o.id FROM organisations'))return {rows:[]};
    return {rows:[]};
  }};
  const launch=new GrafanaLaunch(pool,'https://api.gridex.tech',config,market);
  await assert.rejects(launch.issue({subject,realm:'customer',emailVerified:true,permissions:[]}),
    error=>error.code==='grafana_access_denied');
  const grantQuery=sql.find(query=>query.includes('SELECT o.id FROM organisations'));
  for(const expected of ["prices.service_code='day_ahead'","charts.service_code='visualisations'",
    "z.country='BG'", "z.zone='BG'", "o.status='active'"])
    assert.ok(grantQuery.includes(expected),expected);
  assert.equal(sql.some(query=>query.includes('INSERT INTO grafana_launch_sessions')),false);
});

test('platform dashboard ticket is short-lived, one-time and has host-only cookie',async()=>{
  let inserted=false;
  let consumed=false;
  const pool={query:async(query)=>{
    if(query.includes('INSERT INTO grafana_launch_sessions'))inserted=true;
    if(query.includes('UPDATE grafana_launch_sessions')){
      if(consumed)return {rows:[]};
      consumed=true;return {rows:[{subject,realm:'gridex',organisation_id:null}]};
    }
    return {rows:[]};
  }};
  const launch=new GrafanaLaunch(pool,'https://api.gridex.tech',config,market);
  const result=await launch.issue({subject,realm:'gridex',emailVerified:true,permissions:['platform:manage']});
  assert.equal(inserted,true);
  assert.equal(result.expiresInSeconds,60);
  assert.match(result.url,/^https:\/\/api\.gridex\.tech\/grafana\/launch\?ticket=[A-Za-z0-9_-]{43}$/);
  const ticket=new URL(result.url).searchParams.get('ticket');
  const session=await launch.consume(ticket);
  assert.match(session.cookie,/^__Host-gridex-grafana=[A-Za-z0-9_-]{43}; Path=\/; Secure; HttpOnly; SameSite=Strict; Max-Age=900$/);
  await assert.rejects(launch.consume(ticket),error=>error.code==='invalid_grafana_ticket');
});

test('wrong realm and unverified platform identity cannot launch',async()=>{
  const pool={query:async()=>({rows:[]})};
  const launch=new GrafanaLaunch(pool,'https://api.gridex.tech',config,market);
  await assert.rejects(launch.issue({subject,realm:'gridex',emailVerified:false,permissions:['platform:manage']}),
    error=>error.code==='grafana_access_denied');
  await assert.rejects(launch.issue({subject,realm:'other',emailVerified:true,permissions:['platform:manage']}),
    error=>error.code==='grafana_access_denied');
});

test('every dashboard request rechecks current grants and rejects encoded paths',async()=>{
  let revoked=false;
  const pool={query:async(query)=>{
    if(query.includes('UPDATE grafana_launch_sessions'))
      return {rows:[{subject,realm:'customer',organisation_id:organisationId}]};
    if(query.includes('SELECT subject,realm,organisation_id'))
      return {rows:[{subject,realm:'customer',organisation_id:organisationId}]};
    if(query.includes('SELECT o.id FROM organisations'))
      return {rows:revoked?[]:[{id:organisationId}]};
    return {rows:[]};
  }};
  const launch=new GrafanaLaunch(pool,'https://api.gridex.tech',config,market);
  const session=await launch.consume('A'.repeat(43));
  assert.equal(await launch.check(session.cookie,'/grafana/api/ds/query'),`gridex-${subject}`);
  await assert.rejects(launch.check(session.cookie,'/grafana/%2e%2e/manager/'),
    error=>error.code==='grafana_path_denied');
  revoked=true;
  await assert.rejects(launch.check(session.cookie,'/grafana/api/ds/query'),
    error=>error.code==='grafana_access_denied');
});
