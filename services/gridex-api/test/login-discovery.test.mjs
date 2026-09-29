import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { MemoryRepository } from '../src/repository.mjs';
import { createLoginDiscoveryLimit, normaliseLoginEmail } from '../src/login-discovery.mjs';

const origin = 'https://gridex.tech';
const config = { realm: 'gridex', allowedOrigins: new Set([origin]), maximumBodyBytes: 131072, writesEnabled: false };
async function withServer(app, work) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
const lookup = (base, email, requestOrigin = origin) => fetch(base + '/api/v1/auth/login-realm', {
  method: 'POST', headers: { Origin: requestOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
});

test('email-only realm routing uses no-store POST, never accepts passwords and keeps tenant isolation', async () => {
  const repository = new MemoryRepository({ loginRealms: { 'antouan@novacom.bg': ['novacom'],
    'member@example.invalid': ['alpha', 'beta'] } });
  const app = createApp({ config, repository, authenticate: async () => { throw Error('discovery must be public'); }, openRemote: {} });
  await withServer(app, async base => {
    const customer = await lookup(base, '  ANTOUAN@NOVACOM.BG  ');
    assert.equal(customer.status, 200);
    assert.equal(customer.headers.get('Cache-Control'), 'no-store');
    assert.deepEqual(await customer.json(), { realms: ['novacom'] });
    assert.deepEqual(await (await lookup(base, 'member@example.invalid')).json(), { realms: ['alpha', 'beta'] });
    assert.deepEqual(await (await lookup(base, 'unknown@example.invalid')).json(), { realms: ['gridex'] });
    assert.equal((await lookup(base, 'antouan@novacom.bg', 'https://evil.invalid')).status, 403);
    assert.equal((await lookup(base, 'not-an-email')).status, 400);
    assert.equal((await fetch(base + '/api/v1/auth/login-realm')).status, 405);
    assert.equal((await fetch(base + '/api/v1/auth/login-realm', { method: 'POST', headers: { Origin: origin,
      'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'member@example.invalid', password: 'forbidden' }) })).status, 400);
  });
});

test('lookup guard limits repeated addresses and does not retain plaintext email', () => {
  assert.equal(normaliseLoginEmail(' Test@Example.Com '), 'test@example.com');
  let time = 1000;
  const limit = createLoginDiscoveryLimit(() => time);
  for (let i = 0; i < 8; i++) limit('test@example.com');
  assert.throws(() => limit('test@example.com'), error => error.status === 429);
  time += 300001;
  assert.doesNotThrow(() => limit('test@example.com'));
});

test('public recipient resend never reveals whether a pending invitation exists', async () => {
  const seen=[];
  const invitations={async resendToRecipient(email){seen.push(['member',email]);}};
  const onboarding={async resendToRecipient(email){seen.push(['first-admin',email]);}};
  const app=createApp({config,repository:new MemoryRepository(),authenticate:async()=>{throw Error('must stay public');},
    openRemote:{},invitations,onboarding});
  await withServer(app,async base=>{
    const resend=body=>fetch(base+'/api/v1/auth/resend-invitation',{
      method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),
    });
    const response=await resend({email:'  MEMBER@EXAMPLE.INVALID  '});
    assert.equal(response.status,202);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    assert.deepEqual(await response.json(),{status:'accepted'});
    assert.deepEqual(seen,[['first-admin','member@example.invalid'],['member','member@example.invalid']]);
    assert.equal((await resend({email:'member@example.invalid',password:'x'})).status,400);
  });
});
