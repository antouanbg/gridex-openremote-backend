import { heartbeatStatuses } from './device-heartbeats.mjs';
import { sendMailgun } from './mailgun.mjs';

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const email = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

// Explicit Site-scoped recipients prevent alert mail leaking to another tenant.
export function alertRecipients(value) {
  const entries = JSON.parse(value || '{}');
  if (!entries || Array.isArray(entries) || typeof entries !== 'object') throw new Error('Invalid alert recipients');
  for (const [site, address] of Object.entries(entries)) {
    if (!uuid.test(site) || typeof address !== 'string' || !email.test(address)) throw new Error('Invalid Site alert recipient');
  }
  return entries;
}

export class HeartbeatAlerts {
  constructor(pool, { recipients, mailgun, send = sendMailgun, offlineMs = 90000, now = () => Date.now() }) {
    this.pool = pool; this.recipients = recipients; this.mailgun = mailgun; this.send = send;
    this.offlineMs = offlineMs; this.now = now;
  }
  async scan() {
    const { rows } = await this.pool.query(`SELECT h.gateway_id AS "gatewayId",h.site_id AS "siteId",
      h.source_gateway_id AS "sourceGatewayId",h.observed_at AS "observedAt",
      h.last_successful_contact_at AS "lastSuccessfulContactAt",h.online,
      g.name AS "deviceName",s.name AS "siteName"
      FROM device_heartbeats h JOIN gateways g ON g.id=h.gateway_id
      JOIN gateway_openremote_bindings orb ON orb.gateway_id=h.gateway_id
      JOIN sites s ON s.id=h.site_id AND s.deleted_at IS NULL
      WHERE s.openremote_site_asset_id IS NOT NULL`);
    const now = this.now();
    for (const item of heartbeatStatuses(rows, now, Math.min(30000, this.offlineMs - 1), this.offlineMs)) {
      // No alert for an unconfirmed contact; a lost ROCK source must not also page for ESP.
      if (item.status !== 'offline' && item.status !== 'online') continue;
      if (item.status === 'offline' && item.gatewayId !== item.sourceGatewayId &&
          (!item.lastSuccessfulContactAt || now - Date.parse(item.lastSuccessfulContactAt) <= this.offlineMs)) continue;
      const db = await this.pool.connect();
      let shouldSend = false;
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [item.gatewayId]);
        const { rows: existing } = await db.query('SELECT state,notification_state FROM heartbeat_alerts WHERE gateway_id=$1 FOR UPDATE', [item.gatewayId]);
        if (item.status === 'online') {
          if (existing[0]?.state === 'offline') await db.query(`UPDATE heartbeat_alerts SET state='healthy',recovered_at=now(),updated_at=now() WHERE gateway_id=$1`, [item.gatewayId]);
        } else if (this.recipients[item.siteId]) {
          if (!existing.length) await db.query(`INSERT INTO heartbeat_alerts(gateway_id,site_id,state,opened_at,notification_state)
            VALUES($1,$2,'offline',now(),'pending')`, [item.gatewayId,item.siteId]);
          else if (existing[0].state === 'healthy') await db.query(`UPDATE heartbeat_alerts SET state='offline',opened_at=now(),
            notification_state='pending',mailgun_message_id=NULL,updated_at=now() WHERE gateway_id=$1`, [item.gatewayId]);
          // Commit 'attempted' before calling Mailgun: a timeout or crash cannot auto-send again.
          const claim = await db.query(`UPDATE heartbeat_alerts SET notification_state='attempted',updated_at=now()
            WHERE gateway_id=$1 AND state='offline' AND notification_state='pending' RETURNING gateway_id`, [item.gatewayId]);
          shouldSend = claim.rowCount === 1;
        }
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
      if (!shouldSend) continue;
      try {
        const result = await this.send(this.mailgun, {
          to: this.recipients[item.siteId], subject: `GrideX: липсва heartbeat — ${item.deviceName}`,
          text: `Няма скорошен контакт с ${item.deviceName} в Обект ${item.siteName}.\nПоследен запис: ${item.observedAt}.\nПроверете статуса в GrideX → Устройства. Това е еднократно известие за текущото прекъсване.`,
        });
        await this.pool.query(`UPDATE heartbeat_alerts SET notification_state='queued',mailgun_message_id=$2,updated_at=now()
          WHERE gateway_id=$1 AND state='offline' AND notification_state='attempted'`, [item.gatewayId,result.id]);
      } catch {
        await this.pool.query(`UPDATE heartbeat_alerts SET notification_state='unknown',updated_at=now()
          WHERE gateway_id=$1 AND state='offline' AND notification_state='attempted'`, [item.gatewayId]);
        console.error('Heartbeat alert delivery unconfirmed; inspect Mailgun events before manual retry');
      }
    }
  }
}
