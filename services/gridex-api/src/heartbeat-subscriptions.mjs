import { ApiError } from './errors.mjs';

const validEmail=/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;
export class HeartbeatEmailSubscriptions {
  constructor(pool) { this.pool=pool; }
  async get(principal) {
    const { rows }=await this.pool.query(`SELECT enabled,email FROM heartbeat_email_subscriptions WHERE subject=$1`,[principal.subject]);
    const current=principal.emailVerified&&validEmail.test(principal.email||'')?principal.email.toLowerCase():null;
    return { enabled:rows[0]?.enabled===true&&rows[0].email===current, email:current };
  }
  async set(principal,enabled) {
    if(typeof enabled!=='boolean')throw new ApiError(400,'invalid_preference','A boolean enabled value is required.');
    const email=principal.emailVerified&&validEmail.test(principal.email||'')?principal.email.toLowerCase():null;
    if(enabled&&!email)throw new ApiError(403,'email_not_verified','Verify your account email first.');
    await this.pool.query(`INSERT INTO heartbeat_email_subscriptions(subject,email,enabled,enabled_at)
      VALUES($1,$2,$3,CASE WHEN $3 THEN now() ELSE NULL END)
      ON CONFLICT(subject) DO UPDATE SET email=EXCLUDED.email,enabled=EXCLUDED.enabled,
        enabled_at=CASE WHEN EXCLUDED.enabled AND heartbeat_email_subscriptions.enabled
          AND heartbeat_email_subscriptions.email=EXCLUDED.email THEN heartbeat_email_subscriptions.enabled_at
          WHEN EXCLUDED.enabled THEN now() ELSE NULL END,updated_at=now()`,
    [principal.subject,email||'',enabled]);
    return { enabled,email };
  }
}
