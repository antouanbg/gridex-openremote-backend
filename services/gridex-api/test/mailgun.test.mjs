import test from 'node:test';
import assert from 'node:assert/strict';
import { mailgunConfig, sendMailgun } from '../src/mailgun.mjs';
const config = mailgunConfig({ GRIDEX_MAILGUN_REGION: 'EU', GRIDEX_MAILGUN_DOMAIN: 'mg.example.com',
  GRIDEX_MAILGUN_FROM: 'GrideX <noreply@example.com>', GRIDEX_MAILGUN_API_KEY: 'synthetic-key' });
test('Mailgun EU request disables tracking and distinguishes test acceptance from delivery', async () => {
  const result = await sendMailgun(config, { to: 'owner@example.com', subject: 'Test', text: 'Test', testMode: true }, async (url, opts) => {
    assert.equal(url, 'https://api.eu.mailgun.net/v3/mg.example.com/messages');
    assert.equal(opts.redirect, 'error');
    assert.equal(opts.body.get('o:testmode'), 'yes');
    assert.equal(opts.body.get('o:tracking'), 'no');
    assert.equal(opts.headers.Authorization, `Basic ${Buffer.from('api:synthetic-key').toString('base64')}`);
    return Response.json({ id: '<test@example.com>' });
  });
  assert.equal(result.status, 'test_accepted');
});
test('Mailgun errors do not leak provider body or key and are not retried', async () => {
  let calls = 0;
  await assert.rejects(sendMailgun(config, { to: 'owner@example.com', subject: 'Test', text: 'Test' }, async () => {
    calls++; return new Response('secret-provider-body', { status: 401 });
  }), /HTTP 401/);
  assert.equal(calls, 1);
});
