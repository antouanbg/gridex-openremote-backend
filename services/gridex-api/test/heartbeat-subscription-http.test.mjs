import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { HeartbeatEmailSubscriptions } from '../src/heartbeat-subscriptions.mjs';

test('authenticated account can opt in/out; no subscription exists by default',async()=>{
  let saved=null;
  const pool={query:async(sql,args)=>{
    if(sql.startsWith('SELECT enabled,email'))return {rows:saved?[saved]:[]};
    if(sql.startsWith('INSERT INTO heartbeat_email_subscriptions')){saved={enabled:args[2],email:args[1]};return {rows:[]};}
    throw new Error('unexpected SQL');
  }};
  const audit=[];
  const app=createApp({config:{allowedOrigins:new Set(),maximumBodyBytes:1024},
    authenticate:async()=>({subject:'owner',email:'Owner@Example.com',emailVerified:true,permissions:[]}),
    repository:{getMemberships:async()=>[],audit:async event=>audit.push(event)},openRemote:{},
    heartbeatSubscriptions:new HeartbeatEmailSubscriptions(pool)});
  const server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/api/v1/me/heartbeat-email`;
  try{
    let response=await fetch(url);assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{enabled:false,email:'owner@example.com'});
    response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:true})});
    assert.equal(response.status,200);assert.equal((await response.json()).enabled,true);
    response=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({enabled:false})});
    assert.equal(response.status,200);assert.equal((await response.json()).enabled,false);
    assert.equal(audit.length,2);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
