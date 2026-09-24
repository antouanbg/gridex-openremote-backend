import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuthenticator, withMembershipRoles } from '../src/auth.mjs';

const config = {
  realm: 'gridex', oidcIssuer: 'https://auth.example.test/auth/realms/gridex',
  oidcJwksUri: 'http://keycloak:8080/auth/realms/gridex/protocol/openid-connect/certs',
  oidcAudience: 'gridex-portal', oidcClockToleranceSeconds: 10,
};
function token(issuer) {
  return [Buffer.from('{}').toString('base64url'),
    Buffer.from(JSON.stringify({ iss: issuer })).toString('base64url'), 'signature'].join('.');
}

test('only a known realm can select a key set; issuer and audience still require verification', async () => {
  const seen = [];
  const auth = createAuthenticator(config, {
    isAllowedRealm: async realm => realm === 'tenant-a',
    jwks: () => null,
    jwtVerify: async (_token, _keys, options) => {
      seen.push(options);
      return { payload: { iss: options.issuer, sub: 'tenant-subject',
        aud: 'gridex-portal', email_verified: true } };
    },
  });
  const identity = await auth({ headers: { authorization: `Bearer ${token('https://auth.example.test/auth/realms/tenant-a')}` } });
  assert.equal(identity.realm, 'tenant-a');
  assert.equal(seen[0].issuer, 'https://auth.example.test/auth/realms/tenant-a');
  assert.equal(seen[0].audience, 'gridex-portal');
  await assert.rejects(auth({ headers: { authorization: `Bearer ${token('https://evil.example/realms/tenant-a')}` } }),
    { code: 'invalid_token' });
  await assert.rejects(auth({ headers: { authorization: `Bearer ${token('https://auth.example.test/auth/realms/unknown')}` } }),
    { code: 'invalid_token' });
  assert.equal(seen.length, 1);
});

test('a tenant token cannot gain the pilot platform right even with the same subject', () => {
  const subject = '11111111-1111-4111-8111-111111111111';
  const principal = { subject, realm: 'tenant-a', emailVerified: true };
  assert.equal(withMembershipRoles(principal, [], new Set([subject]), 'gridex')
    .permissions.includes('platform:manage'), false);
});
