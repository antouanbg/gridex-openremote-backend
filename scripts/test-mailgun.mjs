// node --env-file=/private/backend/.env scripts/test-mailgun.mjs recipient@example.com [--send]
// Defaults to provider test mode: accepted does not mean delivered.
import { mailgunConfig, sendMailgun } from '../services/gridex-api/src/mailgun.mjs';
const to = process.argv[2];
const send = process.argv.includes('--send');
try {
  const env = { ...process.env };
  const result = await sendMailgun(mailgunConfig(env), { to, testMode: !send,
    subject: 'GrideX email configuration test / Тест на имейла',
    text: 'GrideX email delivery test. This message grants no account access.\nТест на имейл доставката на GrideX. Това писмо не предоставя достъп до профил.',
  });
  console.log(JSON.stringify(result));
} catch (error) { console.error(error.message); process.exitCode = 1; }
