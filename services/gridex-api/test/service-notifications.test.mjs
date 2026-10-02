import test from 'node:test';
import assert from 'node:assert/strict';
import {ServiceNotifications} from '../src/service-notifications.mjs';

test('organisation requests notify only allowlisted platform subjects; member grants notify exact realm/subject',async()=>{
  const calls=[];
  const db={query:async(sql,params)=>{calls.push({sql,params});return {rows:[]};}};
  const notifications=new ServiceNotifications(db,{platformAdminSubjects:new Set(['owner']),realm:'pilot'},{});
  await notifications.enqueue(db,{eventKey:'request',organisationId:'org',serviceCode:'visualisations',kind:'organisation_requested'});
  assert.deepEqual(calls[0].params.slice(5),['pilot','owner']);
  assert.match(calls[0].sql,/ON CONFLICT DO NOTHING/);
  await notifications.enqueue(db,{eventKey:'grant',organisationId:'org',serviceCode:'visualisations',kind:'member_granted',subject:'member',realm:'customer'});
  assert.deepEqual(calls[1].params.slice(5),['customer','member']);
});

test('unknown mail provider outcome is not retried as pending; successful receipt is queued, not delivered',async()=>{
  for(const fails of [false,true]){
    const calls=[];let sent=0;
    const pool={query:async(sql,params)=>{calls.push({sql,params});
      if(sql.includes("WHERE n.state='pending'"))return {rows:[{id:'id',kind:'member_granted',service_code:'visualisations',organisation_name:'Example',recipient_realm:'customer',recipient_subject:'member'}]};
      return {rows:sql.includes('RETURNING id')?[{id:'id'}]:[]};}};
    const notifications=new ServiceNotifications(pool,{portalOrigin:'https://portal.example'},{mailConfig:()=>({}),profile:async()=>({email:'member@example.test'}),send:async()=>{sent++;if(fails)throw Error('timeout');return {id:'provider-id'};}});
    await notifications.processBatch();
    assert.equal(sent,1);
    assert.ok(calls.some(call=>call.sql.includes(fails?"state='unknown'":"state='queued'")));
    assert.equal(calls.some(call=>call.sql.includes("SET state='delivered'")),false);
  }
});

test('missing mail configuration leaves notifications pending and does not attempt delivery',async()=>{
  let writes=0;
  const notifications=new ServiceNotifications({query:async()=>{writes++;return {rows:[]};}},{},{mailConfig:()=>{throw Error('not configured');},send:async()=>{throw Error('must not send');}});
  await notifications.processBatch();assert.equal(writes,0);
});
