// node --env-file=/private/path/mailgun.env scripts/test-mailgun.mjs recipient@example.com [--send]
// Defaults to provider test mode: accepted does not mean delivered.
import { mailgunConfig, sendMailgun } from '../services/gridex-api/src/mailgun.mjs';
import { execFileSync } from 'node:child_process';
const to = process.argv[2];
const send = process.argv.includes('--send');
try {
  const env = { ...process.env };
  if (process.argv.includes('--keychain')) {
    if (process.platform !== 'darwin') throw new Error('Keychain option requires macOS');
    try { env.GRIDEX_MAILGUN_API_KEY = execFileSync('/usr/bin/security',
      ['find-generic-password', '-s', 'gridex-mailgun-sending', '-a', 'gridex-mailgun', '-w'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { throw new Error('Mailgun sending key is not available in macOS Keychain'); }
  }
  const result = await sendMailgun(mailgunConfig(env), { to, testMode: !send,
    subject: 'GrideX email configuration test / Тест на имейла',
    text: 'GrideX email delivery test. This message grants no account access.\nТест на имейл доставката на GrideX. Това писмо не предоставя достъп до профил.',
  });
  console.log(JSON.stringify(result));
} catch (error) { console.error(error.message); process.exitCode = 1; }
