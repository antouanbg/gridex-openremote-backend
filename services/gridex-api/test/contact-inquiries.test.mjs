import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createApp } from '../src/app.mjs';
import { ContactInquiries } from '../src/contact-inquiries.mjs';

const origin = 'https://portal.example.invalid';
async function withServer(app, work) {
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await work(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('public and verified-user enquiries require a human check and use the configured support mailbox', async () => {
  let time = 1000;
  const messages = [];
  const contactInquiries = new ContactInquiries({ recipient: 'support@example.invalid', cc: 'copy@example.invalid', now: () => time,
    random: () => 4, mailgun: () => ({}), send: async (_config, mail) => { messages.push(mail); return { status: 'queued' }; } });
  const app = createApp({ config: { allowedOrigins: new Set([origin]), maximumBodyBytes: 8192 }, contactInquiries,
    authenticate: async () => ({ subject: 'member', realm: 'customer', email: 'member@example.invalid', emailVerified: true }),
    repository: { assertOrganisationAccess: async () => {} }, openRemote: {} });
  await withServer(app, async base => {
    const challenge = async () => (await (await fetch(base + '/api/v1/contact/challenge', { headers: { Origin: origin } })).json());
    const send = (body, token) => fetch(base + '/api/v1/contact/inquiries', { method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer test' } : {}) },
      body: JSON.stringify(body) });
    const first = await challenge();
    const body = { challengeId: first.id, answer: 8, name: 'Visitor', email: 'visitor@example.invalid',
      topic: 'General question', message: 'Please contact me about GrideX services.', website: '' };
    assert.equal((await send(body)).status, 400); // Too fast, challenge consumed.
    assert.equal((await send(body)).status, 400);
    time += 3000;
    const second = await challenge();
    time += 3000;
    const accepted = await send({ ...body, challengeId: second.id });
    assert.equal(accepted.status, 202);
    assert.deepEqual(await accepted.json(), { status: 'queued' });
    assert.equal(messages[0].to, 'support@example.invalid');
    assert.equal(messages[0].cc, 'copy@example.invalid');
    assert.equal(messages[0].replyTo, 'visitor@example.invalid');
    assert.match(messages[0].text, /visitor@example.invalid/);
    const third = await challenge();
    time += 3000;
    assert.equal((await send({ ...body, challengeId: third.id })).status, 429);
    const fourth = await challenge();
    time += 3000;
    const logged = await send({ ...body, challengeId: fourth.id, email: 'spoof@example.invalid',
      replyEmail: 'alternate@example.invalid' }, true);
    assert.equal(logged.status, 202);
    assert.match(messages[1].text, /member@example.invalid/);
    assert.match(messages[1].text, /alternate@example.invalid/);
    assert.doesNotMatch(messages[1].text, /spoof@example.invalid/);
    assert.equal(messages[1].replyTo, 'alternate@example.invalid');
    const invalid = await challenge();
    time += 3000;
    assert.equal((await send({ ...body, challengeId: invalid.id,
      replyEmail: 'alternate@example.invalid\r\nBcc: attacker@example.invalid' }, true)).status, 400);
    const fifth = await challenge();
    time += 3000;
    assert.equal((await send({ ...body, challengeId: fifth.id, email: 'bot@example.invalid', website: 'https://bot.invalid' })).status, 202);
    assert.equal(messages.length, 2);
    assert.equal((await fetch(base + '/api/v1/contact/challenge', { headers: { Origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await fetch(base + '/api/v1/contact/challenge')).status, 403);
  });
});
