import test from 'node:test';
import assert from 'node:assert/strict';
import { GrafanaLaunch } from '../src/grafana-launch.mjs';

const subject='11111111-1111-4111-8111-111111111111';
const organisationId='22222222-2222-4222-8222-222222222222';
const config={realm:'gridex',platformAdminSubjects:new Set([subject])};
const market={isZoneEnabled:async(country,zone)=>country==='BG'&&zone==='BG'};

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
