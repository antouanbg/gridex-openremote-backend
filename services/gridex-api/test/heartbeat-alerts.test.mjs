import test from 'node:test';
import assert from 'node:assert/strict';
import { HeartbeatAlerts, alertRecipients } from '../src/heartbeat-alerts.mjs';

const siteId='11111111-1111-4111-8111-111111111111';
const gatewayId='115a01ce-4054-4f15-8d7f-44c2175e2caa';
const date=Date.parse('2026-09-24T00:00:00Z');
function fixture() {
  const records=new Map();
  const source={gatewayId,siteId,sourceGatewayId:gatewayId,observedAt:new Date(date).toISOString(),
    lastSuccessfulContactAt:null,online:true,deviceName:'ROCK Pi',siteName:'Test Lab'};
  const rows=[source];
  const pool={
    async query(sql,args=[]) {
      if(sql.includes('FROM device_heartbeats'))return {rows};
      if(sql.startsWith('UPDATE heartbeat_alerts SET notification_state=')){
        const record=records.get(args[0]);
        if(sql.includes("SET notification_state='attempted'")){
          if(record?.state!=='offline'||record?.notification_state!=='pending')return {rowCount:0,rows:[]};
          record.notification_state='attempted';return {rowCount:1,rows:[{gateway_id:args[0]}]};
        }
        record.notification_state=sql.includes("'queued'")?'queued':'unknown';
        return {rowCount:1,rows:[]};
      }
      throw new Error(`Unexpected pool SQL ${sql}`);
    },
    async connect(){return {
      async query(sql,args=[]) {
        if(sql==='BEGIN'||sql==='COMMIT'||sql==='ROLLBACK'||sql.includes('pg_advisory_xact_lock'))return {rows:[]};
        if(sql.startsWith('SELECT state,notification_state'))return {rows:records.has(args[0])?[records.get(args[0])]:[]};
        if(sql.startsWith('INSERT INTO heartbeat_alerts')){records.set(args[0],{state:'offline',notification_state:'pending'});return {rows:[]};}
        if(sql.includes("SET state='healthy'")){records.get(args[0]).state='healthy';return {rows:[]};}
        if(sql.includes("SET state='offline'")){records.set(args[0],{state:'offline',notification_state:'pending'});return {rows:[]};}
        return pool.query(sql,args);
      },release(){}
    };}
  };
  return {pool,records,source,rows};
}
test('alert recipient mapping rejects an unscoped or invalid email',()=>{
  assert.deepEqual(alertRecipients(JSON.stringify({[siteId]:'owner@example.com'})),{[siteId]:'owner@example.com'});
  assert.throws(()=>alertRecipients('{"all":"owner@example.com"}'));
  assert.throws(()=>alertRecipients(JSON.stringify({[siteId]:'a@b.example\nBcc:other@example.com'})));
});
test('one email per outage, none on repeat scan; recovery permits a new episode',async()=>{
  const {pool,records,source}=fixture();let now=date+91000;let sends=0;
  const alerts=new HeartbeatAlerts(pool,{recipients:{[siteId]:'owner@example.com'},mailgun:{},now:()=>now,
    send:async()=>{sends++;return{id:`mail-${sends}`};}});
  await alerts.scan();await alerts.scan();
  assert.equal(sends,1);assert.equal(records.get(gatewayId).notification_state,'queued');
  source.observedAt=new Date(now).toISOString();await alerts.scan();
  assert.equal(records.get(gatewayId).state,'healthy');
  now+=91000;await alerts.scan();assert.equal(sends,2);
});
test('uncertain Mailgun result is not retried automatically',async()=>{
  const {pool,records}=fixture();let sends=0;
  const alerts=new HeartbeatAlerts(pool,{recipients:{[siteId]:'owner@example.com'},mailgun:{},now:()=>date+91000,
    send:async()=>{sends++;throw new Error('timeout');}});
  const old=console.error;console.error=()=>{};
  try{await alerts.scan();await alerts.scan();}finally{console.error=old;}
  assert.equal(sends,1);assert.equal(records.get(gatewayId).notification_state,'unknown');
});
test('never-seen ESP and a lost ROCK source do not create duplicate ESP mail',async()=>{
  const {pool,records,rows}=fixture();let sends=0;
  const espId='22222222-2222-4222-8222-222222222222';
  rows.push({gatewayId:espId,siteId,sourceGatewayId:gatewayId,observedAt:new Date(date).toISOString(),
    lastSuccessfulContactAt:null,online:false,deviceName:'ESP32',siteName:'Test Lab'});
  const alerts=new HeartbeatAlerts(pool,{recipients:{[siteId]:'owner@example.com'},mailgun:{},now:()=>date+91000,
    send:async()=>{sends++;return{id:'mail'};}});
  await alerts.scan();
  assert.equal(sends,1);assert.equal(records.has(espId),false);
});
