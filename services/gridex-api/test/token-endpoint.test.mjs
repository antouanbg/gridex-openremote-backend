import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.mjs';
import { OpenRemoteClient } from '../src/openremote-client.mjs';

test('internal service token URL preserves external issuer', async () => {
  const config = loadConfig({OIDC_ISSUER:'https://localhost/auth/realms/gridex',
    OIDC_TOKEN_ENDPOINT:'http://keycloak:8080/auth/realms/gridex/protocol/openid-connect/token',
    OPENREMOTE_SERVICE_CLIENT_SECRET:'fixture-only'});
  let called;
  const client = new OpenRemoteClient(config, async (url) => {
    called = url;
    return new Response(JSON.stringify({access_token:'fixture-token',expires_in:60}));
  });
  assert.equal(await client.getServiceToken(), 'fixture-token');
  assert.equal(called, config.oidcTokenEndpoint);
  assert.equal(config.oidcIssuer, 'https://localhost/auth/realms/gridex');
});
test('customer asset operations use the verified customer realm and user token, not the pilot service token',async()=>{
  const calls=[];
  const client=new OpenRemoteClient({openRemoteBaseUrl:'https://manager.invalid',realm:'gridex',openRemoteRequestTimeoutMs:1000},async(url,init)=>{
    calls.push({url,auth:init.headers.get('Authorization'),body:init.body});
    return new Response(JSON.stringify({id:'asset-1'}),{status:200});
  });
  await client.createUserAsset({name:'Site',realm:'novacom'},'user-token','novacom');
  await client.linkUserAsset('asset-1','user-1','user-token','novacom');
  assert.deepEqual(calls.map(call=>call.url),['https://manager.invalid/api/novacom/asset','https://manager.invalid/api/novacom/asset/user/link']);
  assert(calls.every(call=>call.auth==='Bearer user-token'));
  assert.match(calls[1].body,/"realm":"novacom"/);
});
