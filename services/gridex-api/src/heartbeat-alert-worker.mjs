import pg from 'pg';
import { HeartbeatAlerts } from './heartbeat-alerts.mjs';
import { mailgunConfig } from './mailgun.mjs';
import { OpenRemoteClient } from './openremote-client.mjs';
import { loadConfig } from './config.mjs';

const offlineSeconds = Number(process.env.GRIDEX_HEARTBEAT_OFFLINE_SECONDS || 90);
if (!Number.isFinite(offlineSeconds) || offlineSeconds < 30 || offlineSeconds > 86400)
  throw new Error('Invalid heartbeat offline threshold');
const pool = new pg.Pool({ max: 2, connectionTimeoutMillis: 10000 });
const alerts = new HeartbeatAlerts(pool, {
  mailgun: mailgunConfig(),
  openRemote: new OpenRemoteClient(loadConfig()),
  offlineMs: offlineSeconds * 1000,
});
let running = true;
process.on('SIGTERM', () => { running = false; });
process.on('SIGINT', () => { running = false; });
while (running) {
  try { await alerts.scan(); }
  catch { console.error('Heartbeat alert scan failed; will retry'); }
  if (running) await new Promise(resolve => setTimeout(resolve, 15000));
}
await pool.end();
