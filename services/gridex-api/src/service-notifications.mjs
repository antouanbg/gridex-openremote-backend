import { randomUUID } from 'node:crypto';
import { sendMailgun, checkMailgunDelivery } from './mailgun.mjs';

const labels = { day_ahead: 'Цени ден напред · България / Day-ahead prices · Bulgaria',
  visualisations: 'Графики и визуализации / Charts and visualisations' };
const messages = {
  organisation_requested: ['Заявка за услуга / Service request', 'Администраторът на организацията заяви услуга. Прегледайте заявката в GrideX. / The organisation administrator requested a service. Review it in GrideX.'],
  organisation_cancelled: ['Отменена заявка / Request cancelled', 'Администраторът отмени заявката за организацията. / The administrator cancelled the organisation request.'],
  member_requested: ['Заявка от потребител / Member service request', 'Потребител от Вашата организация заяви услуга. Прегледайте заявката в GrideX. / A member of your organisation requested a service. Review it in GrideX.'],
  organisation_granted: ['Разрешена услуга / Organisation service enabled', 'Услугата е разрешена за организацията. Разрешете я отделно за избраните потребители. / The service is enabled for the organisation. Grant it separately to selected members.'],
  organisation_revoked: ['Отнета услуга / Organisation service removed', 'Правото на организацията за услугата е отнето. / The organisation service permission was removed.'],
  member_granted: ['Разрешена услуга / Member service enabled', 'Администраторът разреши услугата за Вашия акаунт. Правото действа веднага. / Your administrator enabled the service for your account. Access takes effect immediately.'],
  member_revoked: ['Отнета услуга / Member service removed', 'Достъпът Ви до услугата е отнет. / Your access to the service was removed.'],
  request_rejected: ['Отказана заявка / Service request declined', 'Заявката за услуга е отказана. Подробности ще намерите в GrideX. / Your service request was declined. View details in GrideX.'],
};

// Permission changes and their notification intent commit together. Unknown
// provider outcomes are never automatically resent; only pending safe claims retry.
export class ServiceNotifications {
  constructor(pool, config, { profile, mailConfig, send = sendMailgun, check = checkMailgunDelivery }) {
    Object.assign(this, { pool, config, profile, mailConfig, send, check });
    this.running = false;
  }
  async enqueue(db, { eventKey, organisationId, serviceCode, kind, subject, realm }) {
    let recipients;
    if (kind.startsWith('organisation_') && ['organisation_requested','organisation_cancelled'].includes(kind))
      recipients = [...this.config.platformAdminSubjects].map(subject => ({ subject, realm: this.config.realm }));
    else if (subject && realm) recipients = [{ subject, realm }];
    else recipients = (await db.query(`SELECT m.subject,o.openremote_realm AS realm FROM organisation_memberships m
      JOIN organisations o ON o.id=m.organisation_id WHERE m.organisation_id=$1 AND m.role='administrator'`, [organisationId])).rows;
    for (const recipient of recipients) await db.query(`INSERT INTO service_notifications
      (id,event_key,organisation_id,service_code,kind,recipient_realm,recipient_subject)
      VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING`,
    [randomUUID(), eventKey, organisationId, serviceCode, kind, recipient.realm, recipient.subject]);
  }
  async processBatch() {
    if (this.running) return;
    this.running = true;
    try {
      let mail;
      try { mail = this.mailConfig(); } catch { return; }
      const pending = (await this.pool.query(`SELECT n.*,o.name AS organisation_name FROM service_notifications n
        JOIN organisations o ON o.id=n.organisation_id WHERE n.state='pending' AND n.available_at<=now()
        ORDER BY n.created_at LIMIT 10`)).rows;
      for (const item of pending) {
        let profile;
        try { profile = await this.profile(item.recipient_realm, item.recipient_subject); }
        catch {
          await this.pool.query(`UPDATE service_notifications SET attempts=attempts+1,
            state=CASE WHEN attempts>=4 THEN 'failed' ELSE 'pending' END,
            available_at=now()+interval '10 minutes',updated_at=now() WHERE id=$1 AND state='pending'`, [item.id]);
          continue;
        }
        const claimed = await this.pool.query(`UPDATE service_notifications SET state='sending',recipient_email=$2,
          updated_at=now() WHERE id=$1 AND state='pending' RETURNING id`, [item.id, profile.email]);
        if (!claimed.rows.length) continue;
        const [title, text] = messages[item.kind];
        try {
          const result = await this.send(mail, { to: profile.email, subject: `GrideX: ${title}`,
            text: `${text}\n\n${item.organisation_name}\n${labels[item.service_code] || item.service_code}\n\n${this.config.portalOrigin}/${(item.kind.startsWith('member_') && item.kind !== 'member_requested') || item.kind==='request_rejected' ? 'profile/' : 'customers/users/'}` });
          await this.pool.query(`UPDATE service_notifications SET state='queued',message_id=$2,updated_at=now()
            WHERE id=$1 AND state='sending'`, [item.id, result.id]);
        } catch {
          await this.pool.query(`UPDATE service_notifications SET state='unknown',updated_at=now()
            WHERE id=$1 AND state='sending'`, [item.id]);
        }
      }
      const queued = (await this.pool.query(`SELECT id,message_id,recipient_email FROM service_notifications
        WHERE state='queued' AND updated_at<now()-interval '1 minute' ORDER BY updated_at LIMIT 10`)).rows;
      for (const item of queued) {
        try {
          const state = await this.check(mail, item.message_id, item.recipient_email);
          await this.pool.query(`UPDATE service_notifications SET state=$2,updated_at=now() WHERE id=$1 AND state='queued'`, [item.id, state]);
        } catch { /* Provider verification is read-only and may be tried later. */ }
      }
    } finally { this.running = false; }
  }
  async recoverInterrupted() {
    await this.pool.query(`UPDATE service_notifications SET state='unknown',updated_at=now() WHERE state='sending'`);
  }
}
