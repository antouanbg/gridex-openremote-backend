import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticator} from '../src/auth.mjs';

test('restart gate requires fresh browser auth_time, not a freshly refreshed token',async()=>{
  const config={reauthOnApiRestart:true,oidcAudience:'portal',oidcIssuer:'https://id.example.invalid',oidcClockToleranceSeconds:10};
  const req={headers:{authorization:'Bearer fixture'}};
  const check=payload=>createAuthenticator(config,{startedAt:100000,jwks:{},jwtVerify:async()=>({payload:{sub:'owner',azp:'portal',...payload}})})(req);
  await assert.rejects(check({auth_time:99,iat:120}),error=>error.code==='reauthentication_required');
  await assert.rejects(check({}),error=>error.code==='reauthentication_required');
  assert.equal((await check({auth_time:100})).subject,'owner');
  assert.equal((await check({azp:'machine-client'})).subject,'owner');
});
