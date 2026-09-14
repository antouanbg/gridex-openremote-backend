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
