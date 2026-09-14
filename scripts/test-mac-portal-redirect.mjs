// Run inside the staging API container. No credentials or control writes.
import assert from 'node:assert/strict';
for (const callback of ['http://127.0.0.1:4173/',
  'http://127.0.0.1:4173/en/', 'http://127.0.0.1:4173/silent-check-sso.html',
  'https://example.invalid/']) {
  const url = new URL('http://keycloak:8080/auth/realms/gridex/protocol/openid-connect/auth');
  url.search = new URLSearchParams({ client_id: 'gridex-portal', redirect_uri: callback,
    response_type: 'code', scope: 'openid', state: crypto.randomUUID(),
    nonce: crypto.randomUUID(), code_challenge: 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG',
    code_challenge_method: 'S256' });
  const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
  const html = await response.text();
  if (callback === 'https://example.invalid/') {
    assert.equal(response.status, 400);
    assert.ok(html.includes('Invalid parameter: redirect_uri'));
  } else {
    assert.equal(response.status, 200);
    assert.ok(/name="username"/.test(html) && /name="password"/.test(html));
    assert.ok(!html.includes('Invalid parameter: redirect_uri'));
  }
  console.log(`PASS callback ${callback}`);
}
