import { heartbeatStatuses } from './device-heartbeats.mjs';
import { sendMailgun } from './mailgun.mjs';

export class HeartbeatAlerts {
  constructor(pool, { mailgun, openRemote, send = sendMailgun, offlineMs = 90000, now = () => Date.now() }) {
    this.pool = pool; this.mailgun = mailgun; this.openRemote = openRemote; this.send = send;
    this.offlineMs = offlineMs; this.now = now;
  }
  async scan() {
    const { rows } = await this.pool.query(`SELECT h.gateway_id AS "gatewayId",h.site_id AS "siteId",
      h.source_gateway_id AS "sourceGatewayId",h.observed_at AS "observedAt",
      h.last_successful_contact_at AS "lastSuccessfulContactAt",h.online,
      g.name AS "deviceName",s.name AS "siteName",s.openremote_site_asset_id AS "siteAssetId"
      FROM device_heartbeats h JOIN gateways g ON g.id=h.gateway_id
      JOIN gateway_openremote_bindings orb ON orb.gateway_id=h.gateway_id
      JOIN sites s ON s.id=h.site_id AND s.deleted_at IS NULL
      JOIN organisations o ON o.id=s.organisation_id AND o.status='active'
      WHERE s.openremote_site_asset_id IS NOT NULL`);
    const now = this.now();
    for (const item of heartbeatStatuses(rows, now, Math.min(30000, this.offlineMs - 1), this.offlineMs)) {
      if (item.status !== 'offline' && item.status !== 'online') continue;
      // No email for an unseen ESP or duplicate ESP outage caused by a lost ROCK.
      if (item.status === 'offline' && item.gatewayId !== item.sourceGatewayId &&
          (!item.lastSuccessfulContactAt || now - Date.parse(item.lastSuccessfulContactAt) <= this.offlineMs)) continue;
      const db = await this.pool.connect();
      let openedAt;
      try {
        await db.query('BEGIN');
        await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [item.gatewayId]);
        const { rows: existing } = await db.query('SELECT state FROM heartbeat_alerts WHERE gateway_id=$1 FOR UPDATE', [item.gatewayId]);
        if (item.status === 'online') {
          if (existing[0]?.state === 'offline') await db.query(`UPDATE heartbeat_alerts SET state='healthy',recovered_at=now(),updated_at=now()
            WHERE gateway_id=$1`, [item.gatewayId]);
        } else {
          if (!existing.length) await db.query(`INSERT INTO heartbeat_alerts(gateway_id,site_id,state,opened_at,notification_state)
            VALUES($1,$2,'offline',now(),'pending')`, [item.gatewayId,item.siteId]);
          else if (existing[0].state === 'healthy') await db.query(`UPDATE heartbeat_alerts SET state='offline',opened_at=now(),
            notification_state='pending',mailgun_message_id=NULL,updated_at=now() WHERE gateway_id=$1`, [item.gatewayId]);
          const result=await db.query(`SELECT opened_at AS "openedAt" FROM heartbeat_alerts WHERE gateway_id=$1`, [item.gatewayId]);
          openedAt=result.rows[0]?.openedAt;
        }
        await db.query('COMMIT');
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { db.release(); }
      if (item.status === 'offline' && openedAt) await this.deliver(item,openedAt);
    }
  }
  async deliver(item, openedAt) {
    const { rows: subscribers } = await this.pool.query(`SELECT sub.subject,sub.email FROM heartbeat_email_subscriptions sub
      JOIN organisation_memberships m ON m.subject=sub.subject
      JOIN sites s ON s.organisation_id=m.organisation_id AND s.id=$1
      JOIN organisations o ON o.id=s.organisation_id AND o.status='active'
      WHERE sub.enabled=true AND sub.enabled_at<=$2 AND s.deleted_at IS NULL
      AND (m.all_sites OR EXISTS(SELECT 1 FROM membership_site_grants g WHERE
        g.organisation_id=m.organisation_id AND g.subject=m.subject AND g.site_id=s.id))`, [item.siteId,openedAt]);
    for (const subscriber of subscribers) {
      // OpenRemote remains authoritative for a user's Site link. Outage means no mail.
      let linked;
      try { linked=await this.openRemote.getUserLinkedAssets([item.siteAssetId],subscriber.subject); }
      catch { console.error('OpenRemote link check unavailable; heartbeat email withheld'); continue; }
      if (!linked.some(asset=>asset.id===item.siteAssetId)) continue;
      // Claim before Mailgun. A crash/timeout is unknown, never automatically retried.
      const claimed=await this.pool.query(`INSERT INTO heartbeat_alert_deliveries(gateway_id,opened_at,subject,email,state)
        SELECT $1,$2,$3,$4,'attempted' WHERE EXISTS(SELECT 1 FROM heartbeat_alerts a
          JOIN sites s ON s.id=a.site_id AND s.deleted_at IS NULL
          JOIN organisation_memberships m ON m.organisation_id=s.organisation_id AND m.subject=$3
          JOIN heartbeat_email_subscriptions sub ON sub.subject=$3
          WHERE a.gateway_id=$1 AND a.state='offline' AND a.opened_at=$2
          AND sub.enabled=true AND sub.email=$4 AND sub.enabled_at<=$2
          AND (m.all_sites OR EXISTS(SELECT 1 FROM membership_site_grants g WHERE
            g.organisation_id=m.organisation_id AND g.subject=$3 AND g.site_id=s.id)))
        ON CONFLICT DO NOTHING RETURNING subject`, [item.gatewayId,openedAt,subscriber.subject,subscriber.email]);
      if (claimed.rowCount!==1) continue;
      try {
        const lastContact=item.gatewayId===item.sourceGatewayId ? item.observedAt : item.lastSuccessfulContactAt;
        const result=await this.send(this.mailgun,{
          to:subscriber.email,subject:`GrideX: загубена връзка — ${item.deviceName}`,
          text:`Няма скорошен контакт с ${item.deviceName} в Обект ${item.siteName}.\nПоследен успешен контакт: ${lastContact}.\nПроверете статуса в GrideX → Устройства. Това е еднократно известие за текущото прекъсване.`,
        });
        await this.pool.query(`UPDATE heartbeat_alert_deliveries SET state='queued',mailgun_message_id=$4,updated_at=now()
          WHERE gateway_id=$1 AND opened_at=$2 AND subject=$3 AND state='attempted'`,[item.gatewayId,openedAt,subscriber.subject,result.id]);
      } catch {
        await this.pool.query(`UPDATE heartbeat_alert_deliveries SET state='unknown',updated_at=now()
          WHERE gateway_id=$1 AND opened_at=$2 AND subject=$3 AND state='attempted'`,[item.gatewayId,openedAt,subscriber.subject]);
        console.error('Heartbeat email delivery unconfirmed; inspect Mailgun before manual retry');
      }
    }
  }
}
