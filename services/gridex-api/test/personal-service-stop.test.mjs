import test from 'node:test';
import assert from 'node:assert/strict';
import {ServiceEntitlements} from '../src/service-entitlements.mjs';
import {ServiceRequests} from '../src/service-requests.mjs';
import {createServer} from 'node:http';
import {createApp} from '../src/app.mjs';
import {ApiError} from '../src/errors.mjs';
const org='11111111-1111-4111-8111-111111111111';
const id='22222222-2222-4222-8222-222222222222';
const user={subject:'member',realm:'customer',emailVerified:true,permissions:[]};
test('HTTP personal mutations require authentication and never accept a body subject as identity',async()=>{
  const calls=[];
  const server=createServer(createApp({config:{realm:'customer',allowedOrigins:new Set()},
    authenticate:async req=>{if(!req.headers.authorization)throw new ApiError(401,'authentication_required','Sign in');return {...user,roles:[]};},
    repository:{getMemberships:async()=>[{organisationId:org,role:'viewer'}]},
    serviceEntitlements:{stopOwn:async(p,o,c)=>{calls.push([p.subject,o,c]);return {enabled:false};}},
    serviceRequests:{cancelMember:async(p,r)=>{calls.push([p.subject,r]);return {stage:'cancelled'};}}
  }));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try {
    const path='/api/v1/me/services/day_ahead/stop';
    assert.equal((await fetch(base+path,{method:'POST'})).status,401);
    const headers={Authorization:'Bearer fixture','Content-Type':'application/json'};
    assert.equal((await fetch(base+path,{method:'POST',headers,body:JSON.stringify({organisationId:org,subject:'other'})})).status,200);
    assert.equal((await fetch(base+'/api/v1/me/service-requests/'+id+'/cancel',{method:'POST',headers,body:'{"subject":"other"}'})).status,200);
    assert.deepEqual(calls,[[user.subject,org,'day_ahead'],[user.subject,id]]);
  }finally{await new Promise(r=>server.close(r));}
});
function fixture({membership=true,request=true,active=false}={}){
  const calls=[];let removed=false;
  const db={release(){},async query(sql,args){calls.push({sql,args});
    if(sql.includes('FOR SHARE OF o,m'))return {rows:membership?[{subject:user.subject}]:[]};
    if(sql.includes('FOR UPDATE OF r'))return {rows:request?[{id,organisation_id:org,service_code:'day_ahead'}]:[]};
    if(sql.startsWith('SELECT 1 FROM member_services'))return {rows:active?[{}]:[]};
    if(sql.includes('DELETE FROM member_services')){const rows=removed?[]:[{subject:user.subject}];removed=true;return {rows};}
    return {rows:[]};}};
  return {calls,pool:{connect:async()=>db}};
}
test('self stop deletes only current subject grant and is idempotent, never organisation or Site rights',async()=>{
  const f=fixture();const grants=new ServiceEntitlements(f.pool,{});
  assert.deepEqual(await grants.stopOwn(user,org,'day_ahead'),{code:'day_ahead',enabled:false,changed:true});
  assert.equal((await grants.stopOwn(user,org,'day_ahead')).changed,false);
  const del=f.calls.find(c=>c.sql.includes('DELETE FROM member_services'));
  assert.deepEqual(del.args,[org,'day_ahead',user.subject]);
  assert.match(f.calls.find(c=>c.sql.includes('FOR SHARE')).sql,/o.openremote_realm=\$3/);
  assert.equal(f.calls.some(c=>/DELETE FROM (organisation|membership)|INSERT INTO member_services/.test(c.sql)),false);
  assert.equal(f.calls.filter(c=>c.sql.includes('self_stopped')).length,1);
});
test('self stop rejects wrong realm or absent membership, unverified identity and platform scope',async()=>{
  const f=fixture({membership:false});const grants=new ServiceEntitlements(f.pool,{});
  for(const p of [user,{...user,emailVerified:false},{...user,permissions:['platform:manage']}])
    await assert.rejects(grants.stopOwn(p,org,'visualisations'),e=>e.code==='permission_denied');
  assert.equal(f.calls.some(c=>c.sql.includes('DELETE FROM')),false);
  assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));
});
test('member cancellation requires own realm/subject, member scope and open state; never removes a grant',async()=>{
  const f=fixture();const requests=new ServiceRequests(f.pool,{},null);
  assert.deepEqual(await requests.cancelMember(user,id),{id,stage:'cancelled'});
  const read=f.calls.find(c=>c.sql.includes('FOR UPDATE OF r'));
  assert.deepEqual(read.args,[id,user.subject,user.realm]);
  assert.match(read.sql,/r.request_scope='member'/);assert.match(read.sql,/r.state='open'/);
  assert.equal(f.calls.some(c=>c.sql.includes('DELETE FROM')),false);
  assert.ok(f.calls.some(c=>c.sql.includes("state='cancelled'")));
});
test('foreign, decided or active requests cannot be cancelled as pending',async()=>{
  for(const options of [{request:false},{active:true}]){
    const f=fixture(options);const requests=new ServiceRequests(f.pool,{},null);
    await assert.rejects(requests.cancelMember(user,id),e=>['service_request_unavailable','service_already_enabled'].includes(e.code));
    assert.equal(f.calls.some(c=>c.sql.startsWith('UPDATE')),false);
    assert.ok(f.calls.some(c=>c.sql==='ROLLBACK'));
  }
});
