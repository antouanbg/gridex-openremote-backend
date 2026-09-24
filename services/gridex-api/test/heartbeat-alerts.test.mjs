import test from 'node:test';
import assert from 'node:assert/strict';
import { HeartbeatAlerts } from '../src/heartbeat-alerts.mjs';
import { HeartbeatEmailSubscriptions } from '../src/heartbeat-subscriptions.mjs';

const siteId='11111111-1111-4111-8111-111111111111';
const gatewayId='22222222-2222-4222-8222-222222222222';
const date=Date.parse('2026-09-24T00:00:00Z');
function fixture() {
  const source={gatewayId,siteId,sourceGatewayId:gatewayId,observedAt:new Date(date).toISOString(),
    lastSuccessfulContactAt:null,online:true,deviceName:'ROCK Pi',siteName:'Test Lab',siteAssetId:'site-asset'};
  const rows=[source],alerts=new Map(),deliveries=new Set();
  const subscribers=[{subject:'owner',email:'owner@example.com'}];
  let enabledAt=new Date(date-60000);
  const pool={
    async query(sql,args=[]) {
      if(sql.includes('FROM device_heartbeats'))return {rows};
      if(sql.includes('FROM heartbeat_email_subscriptions sub'))return {rows:enabledAt<=args[1]?subscribers:[]};
      if(sql.startsWith('INSERT INTO heartbeat_alert_deliveries')){
        const key=`${args[0]}:${args[1]}:${args[2]}`;
        if(deliveries.has(key)||alerts.get(args[0])?.state!=='offline')return {rowCount:0,rows:[]};
        deliveries.add(key);return {rowCount:1,rows:[{subject:args[2]}]};
      }
      if(sql.startsWith('UPDATE heartbeat_alert_deliveries'))return {rowCount:1,rows:[]};
      throw new Error(`Unexpected pool SQL ${sql}`);
    },
    async connect(){return {
      async query(sql,args=[]) {
        if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
        if(sql.startsWith('SELECT state FROM heartbeat_alerts'))return {rows:alerts.has(args[0])?[alerts.get(args[0])]:[]};
        if(sql.startsWith('INSERT INTO heartbeat_alerts')){alerts.set(args[0],{state:'offline',openedAt:new Date(date+91000)});return {rows:[]};}
        if(sql.includes("SET state='healthy'")){alerts.get(args[0]).state='healthy';return {rows:[]};}
        if(sql.includes("SET state='offline'")){alerts.set(args[0],{state:'offline',openedAt:new Date(date+182000)});return {rows:[]};}
        if(sql.startsWith('SELECT opened_at'))return {rows:[{openedAt:alerts.get(args[0]).openedAt}]};
        return pool.query(sql,args);
      },release(){}
    };}
  };
  return {pool,source,rows,alerts,deliveries,subscribers,setEnabledAt:v=>{enabledAt=v;}};
}
test('opt-in is false by default and enabling requires verified identity email',async()=>{
  const calls=[];
  const store=new HeartbeatEmailSubscriptions({query:async(sql,args)=>{
    calls.push({sql,args});return {rows:[]};
  }});
  const principal={subject:'owner',email:'Owner@Example.com',emailVerified:true};
  assert.deepEqual(await store.get(principal),{enabled:false,email:'owner@example.com',scope:'all_events'});
  await assert.rejects(store.set({...principal,emailVerified:false},true),{code:'email_not_verified'});
  await assert.rejects(store.set(principal,'yes'),{code:'invalid_preference'});
  assert.deepEqual(await store.set(principal,true),{enabled:true,email:'owner@example.com',scope:'all_events'});
  assert.equal(calls.at(-1).args[1],'owner@example.com');
  assert.deepEqual(await store.set(principal,false),{enabled:false,email:'owner@example.com',scope:'all_events'});
});
test('one email per future outage and user; recovery permits a second episode',async()=>{
  const x=fixture();let now=date+91000,sends=0;
  const alerts=new HeartbeatAlerts(x.pool,{mailgun:{},openRemote:{getUserLinkedAssets:async()=>[{id:'site-asset'}]},
    now:()=>now,send:async()=>{sends++;return{id:`mail-${sends}`};}});
  await alerts.scan();await alerts.scan();assert.equal(sends,1);
  x.source.observedAt=new Date(now).toISOString();await alerts.scan();
  assert.equal(x.alerts.get(gatewayId).state,'healthy');
  now+=91000;await alerts.scan();assert.equal(sends,2);
});
test('ESP contact loss alerts separately while ROCK is online, without a duplicate when ROCK later disconnects',async()=>{
  const x=fixture();let now=date+91000;
  const espId='33333333-3333-4333-8333-333333333333';
  x.source.observedAt=new Date(now).toISOString();
  x.rows.push({gatewayId:espId,siteId,sourceGatewayId:gatewayId,
    observedAt:new Date(now).toISOString(),lastSuccessfulContactAt:new Date(date).toISOString(),
    online:false,deviceName:'ESP32',siteName:'Test Lab',siteAssetId:'site-asset'});
  const messages=[];
  const alerts=new HeartbeatAlerts(x.pool,{mailgun:{},openRemote:{getUserLinkedAssets:async()=>[{id:'site-asset'}]},
    now:()=>now,send:async(_config,message)=>{messages.push(message);return{id:`mail-${messages.length}`};}});
  await alerts.scan();await alerts.scan();
  assert.equal(x.alerts.get(espId)?.state,'offline');
  assert.deepEqual(messages.map(message=>message.subject),['GrideX: загубена връзка — ESP32']);
  assert.match(messages[0].text,new RegExp(new Date(date).toISOString()));
  now+=91000;await alerts.scan();
  assert.equal(x.alerts.get(gatewayId)?.state,'offline');
  assert.equal(messages.length,2);
  assert.match(messages[1].subject,/ROCK Pi/);
});
test('late opt-in, revoked OpenRemote link and never-seen ESP do not send',async()=>{
  const x=fixture();x.setEnabledAt(new Date(date+92000));let sends=0;
  x.rows.push({gatewayId:'33333333-3333-4333-8333-333333333333',siteId,sourceGatewayId:gatewayId,
    observedAt:new Date(date).toISOString(),lastSuccessfulContactAt:null,online:false,siteAssetId:'site-asset'});
  const alerts=new HeartbeatAlerts(x.pool,{mailgun:{},openRemote:{getUserLinkedAssets:async()=>[]},
    now:()=>date+91000,send:async()=>{sends++;return{id:'mail'};}});
  await alerts.scan();assert.equal(sends,0);assert.equal(x.alerts.size,1);
  x.setEnabledAt(new Date(date-60000));await alerts.scan();assert.equal(sends,0);
});
test('Mailgun timeout is not retried for the same subscriber and outage',async()=>{
  const x=fixture();let sends=0;
  const alerts=new HeartbeatAlerts(x.pool,{mailgun:{},openRemote:{getUserLinkedAssets:async()=>[{id:'site-asset'}]},
    now:()=>date+91000,send:async()=>{sends++;throw new Error('timeout');}});
  const old=console.error;console.error=()=>{};
  try{await alerts.scan();await alerts.scan();}finally{console.error=old;}
  assert.equal(sends,1);assert.equal(x.deliveries.size,1);
});
