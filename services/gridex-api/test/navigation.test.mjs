import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveNavigation} from '../src/navigation.mjs';
import {createServer} from 'node:http';
import {createApp} from '../src/app.mjs';
import {ApiError} from '../src/errors.mjs';
const rows=[{id:'members',requirement:'admin'},{id:'market',requirement:'service',serviceCode:'day_ahead'},
  {id:'forecast',requirement:'coming_soon'},{id:'battery',requirement:'inventory'}];
test('member grants are organisation scoped; catalogue visibility is not a grant',()=>{
  const result=effectiveNavigation(rows,{emailVerified:true,permissions:[]},
    [{organisationId:'own',role:'viewer'}],[{organisationId:'other',code:'day_ahead'}]);
  assert.equal(result[0].visible,false);
  assert.equal(result[1].state,'denied');
  assert.equal(result[1].visible,true);
  assert.equal(result[2].state,'coming_soon');
  assert.equal(result[3].state,'inventory_required');
});
test('organisation administrators still need individual service grants',()=>{
  const memberships=[{organisationId:'own',role:'administrator'}];
  assert.equal(effectiveNavigation(rows,{},memberships,[])[1].state,'denied');
  assert.equal(effectiveNavigation(rows,{},memberships,[{organisationId:'own',code:'day_ahead'}])[1].state,'available');
});
test('verified platform admin has no self approval but future services stay unavailable',()=>{
  const result=effectiveNavigation(rows,{emailVerified:true,permissions:['platform:manage']},[],[]);
  assert.equal(result[0].visible,true);
  assert.equal(result[1].state,'available');
  assert.equal(result[2].state,'coming_soon');
});
test('HTTP navigation requires identity, is uncached and fails closed on catalogue failure',async()=>{
  let broken=false;
  const app=createApp({
    config:{realm:'test',allowedOrigins:new Set()},
    authenticate:async req=>{if(!req.headers.authorization)throw new ApiError(401,'authentication_required','Sign in.');
      return {realm:'test',subject:'viewer',emailVerified:true,roles:[],permissions:[]};},
    repository:{getMemberships:async()=>[{organisationId:'own',role:'viewer'}],
      navigationCatalog:async()=>{if(broken)throw new ApiError(503,'navigation_unavailable','Cannot verify.');return rows;}},
    serviceEntitlements:{mine:async()=>[]},
  });
  const server=createServer(app);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const url='http://127.0.0.1:'+server.address().port+'/api/v1/me/navigation';
    assert.equal((await fetch(url)).status,401);
    const result=await fetch(url,{headers:{Authorization:'Bearer fixture'}});
    assert.equal(result.status,200);
    assert.equal(result.headers.get('cache-control'),'no-store');
    const body=await result.json();
    assert.equal(body.subject,'viewer');
    assert.equal(body.items[0].visible,false);
    broken=true;
    assert.equal((await fetch(url,{headers:{Authorization:'Bearer fixture'}})).status,503);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
