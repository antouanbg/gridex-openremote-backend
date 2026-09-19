import { readFileSync } from 'node:fs';

export function mailgunConfig(env = process.env) {
  const region = env.GRIDEX_MAILGUN_REGION || 'EU';
  const domain = env.GRIDEX_MAILGUN_DOMAIN || '';
  const from = env.GRIDEX_MAILGUN_FROM || '';
  const key = env.GRIDEX_MAILGUN_KEY_FILE
    ? readFileSync(env.GRIDEX_MAILGUN_KEY_FILE, 'utf8').trim()
    : env.GRIDEX_MAILGUN_API_KEY;
  if (!['EU', 'US'].includes(region) || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)
      || !key || !from || /[\r\n]/.test(from)) throw new Error('Mailgun configuration incomplete');
  return { domain, from, key, base: region === 'EU' ? 'https://api.eu.mailgun.net' : 'https://api.mailgun.net' };
}

// Internal transport only. No public arbitrary-email endpoint and no automatic retry:
// a timeout may mean the provider already queued the message.
export async function sendMailgun(config, { to, subject, text, testMode = false }, fetcher = fetch) {
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(to) || !subject || /[\r\n]/.test(subject) || !text) {
    throw new Error('Invalid email message');
  }
  const body = new FormData();
  for (const [name, value] of Object.entries({ from: config.from, to, subject, text,
    'o:tracking': 'no', 'o:tracking-clicks': 'no', 'o:tracking-opens': 'no' })) body.set(name, value);
  if (testMode) body.set('o:testmode', 'yes');
  let response;
  try {
    response = await fetcher(`${config.base}/v3/${encodeURIComponent(config.domain)}/messages`, {
      method: 'POST', redirect: 'error', body, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Basic ${Buffer.from(`api:${config.key}`).toString('base64')}` },
    });
  } catch { throw new Error('Mailgun delivery status unknown; check provider events before retrying'); }
  if (!response.ok) throw new Error(`Mailgun rejected request (HTTP ${response.status}); verify domain, region, key and DNS`);
  const result = await response.json();
  if (typeof result.id !== 'string') throw new Error('Mailgun returned no message ID');
  return { status: testMode ? 'test_accepted' : 'queued', id: result.id };
}
