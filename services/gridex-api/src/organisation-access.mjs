import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { sendMailgun, checkMailgunDelivery } from './mailgun.mjs';

export const suspensionMessage = 'Your organisation is temporarily suspended. Contact the super administrator. / Организацията е временно спряна. Свържете се със супер администратора.';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class OrganisationAccess {
  constructor(pool, setup, config, mailConfig, transport = {}) {
    Object.assign(this, { pool, setup, config, mailConfig });
    this.send = transport.send || sendMailgun;
    this.check = transport.check || checkMailgunDelivery;
  }
  authorize(principal, recent = false) {
    if (!principal.emailVerified || principal.realm !== this.config.realm
        || !this.config.platformAdminSubjects?.has(principal.subject)
        || !principal.permissions?.includes('platform:manage'))
      throw new ApiError(403, 'permission_denied', 'Verified super administrator required.');
    if (recent && (!Number.isFinite(principal.authTime) || Date.now()/1000 - principal.authTime > 600))
      throw new ApiError(401, 'recent_login_required', 'Sign in again before changing organisation access.');
  }
  async audit(db, principal, id, action, result = 'success') {
    await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
      VALUES($1,$2,'organisation',$3,$4,$5)`, [principal.subject, action, id, result, randomUUID()]);
  }
  async list(principal) {
    this.authorize(principal);
    const { rows } = await this.pool.query(`SELECT o.id,o.name,o.openremote_realm AS realm,o.status,
      o.access_revision AS revision,a.id AS "operationId",a.target,a.state AS "operationState",a.mail_state AS "mailState"
      FROM organisations o LEFT JOIN organisation_access_operations a
      ON a.organisation_id=o.id AND a.revision=o.access_revision
      WHERE o.openremote_realm<>$1 AND o.openremote_realm<>'master' AND o.status IN ('active','suspended')
      AND EXISTS(SELECT 1 FROM organisation_onboarding_invitations i WHERE i.organisation_id=o.id AND i.state='accepted')
      ORDER BY o.name`, [this.config.realm]);
    return rows;
  }
  async change(principal, id, input) {
    this.authorize(principal, true);
    if (!uuid.test(input?.operationId || '') || !Number.isSafeInteger(input?.revision) || input.revision < 0
        || !['active','suspended'].includes(input?.status))
      throw new ApiError(400, 'invalid_access_change', 'Operation ID, current revision and target status are required.');
    const db = await this.pool.connect();
    let locked = false, inTransaction = false;
    try {
      // Session lock spans committed denial, upstream effects and mail claim. Other
      // API instances cannot interleave suspend/restore or duplicate a send.
      const lock = await db.query('SELECT pg_try_advisory_lock(hashtextextended($1, 13)) AS locked', [id]);
      if (!lock.rows[0]?.locked) throw new ApiError(409, 'access_change_busy', 'An access change is already running. Reload its status.');
      locked = true;
      await db.query('BEGIN'); inTransaction = true;
      const { rows } = await db.query(`SELECT o.*,i.subject AS admin_subject,i.email AS admin_email
        FROM organisations o JOIN organisation_onboarding_invitations i ON i.organisation_id=o.id AND i.state='accepted'
        WHERE o.id=$1 FOR UPDATE OF o`, [id]);
      const org = rows[0];
      if (!org) throw new ApiError(404, 'organisation_not_found', 'Accepted customer organisation not found.');
      if ([this.config.realm,'master'].includes(org.openremote_realm) || org.status === 'archived')
        throw new ApiError(403, 'protected_organisation', 'This organisation cannot be suspended or restored here.');
      let op = (await db.query('SELECT * FROM organisation_access_operations WHERE id=$1', [input.operationId])).rows[0];
      if (op) {
        if (op.organisation_id !== id || op.target !== input.status || op.revision !== input.revision + 1
            || org.access_revision !== op.revision)
          throw new ApiError(409, 'access_operation_conflict', 'This operation is stale or belongs to another change.');
      } else {
        if (org.access_revision !== input.revision)
          throw new ApiError(409, 'stale_revision', 'Organisation access changed. Reload before trying again.');
        if (org.status === input.status)
          throw new ApiError(409, 'access_unchanged', 'Organisation already has this status.');
        const previous = (await db.query('SELECT * FROM organisation_access_operations WHERE organisation_id=$1 AND revision=$2', [id, org.access_revision])).rows[0];
        if (previous?.state === 'pending' || (input.status === 'active' && previous?.target !== 'suspended'))
          throw new ApiError(409, 'access_reconciliation_required', 'Complete the pending suspension before restoring access.');
        op = { id: input.operationId, organisation_id: id, revision: org.access_revision + 1,
          target: input.status, state: 'pending', mail_state: input.status === 'suspended' ? 'pending' : 'not_required',
          recipient: org.admin_email };
        await db.query(`INSERT INTO organisation_access_operations(id,organisation_id,revision,target,actor,mail_state,recipient)
          VALUES($1,$2,$3,$4,$5,$6,$7)`, [op.id,id,op.revision,op.target,principal.subject,op.mail_state,op.recipient]);
        // Both suspension and restoration stay denied until upstream verification.
        await db.query(`UPDATE organisations SET status='suspended',access_revision=$2,
          access_valid_after=greatest(access_valid_after,extract(epoch FROM now())::bigint),updated_at=now() WHERE id=$1`, [id,op.revision]);
        await this.audit(db, principal, id, `organisation.${op.target}.requested`);
      }
      await db.query('COMMIT'); inTransaction = false;
      if (op.state !== 'applied') {
        try {
          await this.setup.setOrganisationAccess(org.openremote_realm, op.target === 'active');
          await db.query('BEGIN'); inTransaction = true;
          await db.query("UPDATE organisation_access_operations SET state='applied' WHERE id=$1", [op.id]);
          await db.query('UPDATE organisations SET status=$2,updated_at=now() WHERE id=$1', [id,op.target]);
          await this.audit(db, principal, id, `organisation.${op.target}.applied`);
          await db.query('COMMIT'); inTransaction = false;
          op.state = 'applied';
        } catch (error) {
          if (inTransaction) { await db.query('ROLLBACK'); inTransaction = false; }
          await this.audit(db, principal, id, `organisation.${op.target}.reconciliation`, 'failed');
          throw new ApiError(503, 'access_reconciliation_required', 'Portal access is blocked. Upstream access change is not verified; retry the same operation.');
        }
      }
      if (op.target === 'suspended') await this.notify(db, principal, org, op);
      return { operationId: op.id, status: op.target, revision: op.revision, operationState: op.state, mailState: op.mail_state };
    } finally {
      if (inTransaction) await db.query('ROLLBACK');
      if (locked) await db.query('SELECT pg_advisory_unlock(hashtextextended($1, 13))', [id]);
      db.release();
    }
  }
  async notify(db, principal, org, op) {
    if (op.mail_state !== 'pending') return;
    let config;
    try {
      config = this.mailConfig();
      await this.setup.verifyUser(org.openremote_realm, org.admin_subject, org.admin_email);
    } catch { return; } // No send attempt: safe to reconcile configuration/identity and retry.
    const claim = await db.query(`UPDATE organisation_access_operations SET mail_state='sending'
      WHERE id=$1 AND mail_state='pending' RETURNING id`, [op.id]);
    if (!claim.rows.length) return;
    op.mail_state = 'unknown';
    try {
      const result = await this.send(config, { to: op.recipient,
        subject: 'GrideX: organisation suspended / Организацията е временно спряна',
        text: `${org.name}\n\n${suspensionMessage}\n\nYour accounts and inventory are preserved. Only the super administrator can restore access. After restoration, sign in again.\n\nАкаунтите и инвентарът са запазени. Само супер администраторът може да възстанови достъпа. След възстановяване влезте отново.` });
      await db.query("UPDATE organisation_access_operations SET mail_state='queued',message_id=$2 WHERE id=$1", [op.id,result.id]);
      op.mail_state = 'queued';
      await this.audit(db, principal, org.id, 'organisation.suspension.email_queued');
    } catch {
      await db.query("UPDATE organisation_access_operations SET mail_state='unknown' WHERE id=$1 AND mail_state='sending'", [op.id]);
      await this.audit(db, principal, org.id, 'organisation.suspension.email_unknown', 'failed');
    }
    if (op.mail_state === 'queued') {
      try {
        const message = (await db.query('SELECT message_id FROM organisation_access_operations WHERE id=$1', [op.id])).rows[0];
        const state = await this.check(config, message.message_id, op.recipient);
        await db.query("UPDATE organisation_access_operations SET mail_state=$2,checked_at=now() WHERE id=$1 AND mail_state='queued'", [op.id,state]);
        op.mail_state = state;
        if (state !== 'queued') await this.audit(db, principal, org.id, `organisation.suspension.email_${state}`);
      } catch { /* Queued is explicitly unconfirmed; delivery can be checked later without resending. */ }
    }
    // Never automatically resend sending/unknown/queued/failed operations.
  }
  async checkDelivery(principal, id) {
    this.authorize(principal);
    const { rows } = await this.pool.query(`SELECT a.* FROM organisation_access_operations a
      JOIN organisations o ON o.id=a.organisation_id AND o.access_revision=a.revision
      WHERE o.id=$1 AND o.openremote_realm<>$2`, [id,this.config.realm]);
    const op = rows[0];
    if (!op) throw new ApiError(404, 'operation_not_found', 'No current access operation.');
    if (op.mail_state === 'queued' && op.message_id) {
      const state = await this.check(this.mailConfig(), op.message_id, op.recipient);
      await this.pool.query(`UPDATE organisation_access_operations SET mail_state=$2,checked_at=now()
        WHERE id=$1 AND mail_state='queued'`, [op.id,state]);
      if (state !== 'queued') await this.audit(this.pool, principal, id, `organisation.suspension.email_${state}`);
      op.mail_state = state;
    }
    return { mailState: op.mail_state, operationId: op.id };
  }
}
