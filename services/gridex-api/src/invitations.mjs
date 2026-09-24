import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';

export function validateInvitation(input) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const siteIds = input?.siteIds;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || !['viewer', 'operator', 'energy_manager', 'integrator'].includes(input?.role)
      || !Array.isArray(siteIds) || !siteIds.length || siteIds.length > 100
      || siteIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
    throw new ApiError(400, 'invalid_invitation', 'Email, supported role and explicit siteIds are required.');
  }
  return { email, role: input.role, siteIds: [...new Set(siteIds)] };
}

// Separate enrollment client, never the OpenRemote Asset service account.
export class EnrollmentIdentity {
  constructor(config) { this.config = config; }
  async request(path, options = {}) {
    const c = this.config;
    if (!c.enrollmentEnabled || !c.enrollmentClientSecret) {
      throw new ApiError(503, 'enrollment_unavailable', 'Email enrollment is not configured.');
    }
    const tokenResponse = await fetch(c.oidcTokenEndpoint, { method: 'POST',
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'gridex-enrollment',
        client_secret: c.enrollmentClientSecret }), signal: AbortSignal.timeout(10000) });
    if (!tokenResponse.ok) throw new ApiError(503, 'enrollment_unavailable', 'Enrollment authentication failed.');
    const token = await tokenResponse.json();
    const response = await fetch(`${c.enrollmentAdminUrl}${path}`, { ...options,
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new ApiError(503, 'enrollment_unavailable', 'Identity or email operation failed.');
    return response.status === 204 || response.status === 201 ? null : response.json();
  }
  async prepareUser(email) {
    let users = await this.request(`/users?email=${encodeURIComponent(email)}&exact=true`);
    let created = false;
    if (!users.length) {
      await this.request('/users', { method: 'POST', body: JSON.stringify({ username: email, email,
        enabled: true, emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] }) });
      created = true;
      users = await this.request(`/users?email=${encodeURIComponent(email)}&exact=true`);
    }
    if (users.length !== 1 || !users[0].enabled || users[0].email?.toLowerCase() !== email) {
      throw new ApiError(409, 'identity_conflict', 'The invited identity cannot be used.');
    }
    return { subject: users[0].id, created };
  }
  async sendActions(subject, created) {
    const query = new URLSearchParams({ client_id: this.config.oidcAudience,
      redirect_uri: this.config.enrollmentRedirectUri, lifespan: '86400' });
    await this.request(`/users/${encodeURIComponent(subject)}/execute-actions-email?${query}`, {
      method: 'PUT', body: JSON.stringify(created ? ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] : ['VERIFY_EMAIL']),
    });
  }
}

export class InvitationService {
  constructor(pool, identity) { this.pool = pool; this.identity = identity; }
  async transaction(action) {
    const db = await this.pool.connect();
    try { await db.query('BEGIN'); const result = await action(db); await db.query('COMMIT'); return result; }
    catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  async admin(db, subject, org, realm = null) {
    const { rows } = await db.query(`SELECT m.role,m.all_sites,o.openremote_realm AS realm FROM organisation_memberships m JOIN organisations o
      ON o.id=m.organisation_id WHERE m.subject=$1 AND m.organisation_id=$2
      AND o.status='active' AND ($3::text IS NULL OR o.openremote_realm=$3)
      FOR SHARE OF m,o`, [subject, org, realm]);
    if (rows[0]?.role !== 'administrator') throw new ApiError(403, 'permission_denied', 'Organisation administrator required.');
    return rows[0];
  }
  async permittedSites(db, subject, org, siteIds, realm = null) {
    const admin = await this.admin(db, subject, org, realm);
    const sites = await db.query(`SELECT id FROM sites WHERE organisation_id=$1
      AND id=ANY($2::uuid[]) AND deleted_at IS NULL
      AND ($3 OR EXISTS(SELECT 1 FROM membership_site_grants g WHERE
        g.organisation_id=$1 AND g.subject=$4 AND g.site_id=sites.id))
      FOR SHARE`, [org, siteIds, admin.all_sites, subject]);
    if (sites.rows.length !== siteIds.length)
      throw new ApiError(403, 'site_access_denied', 'Only Sites managed by this administrator may be granted.');
    return admin.realm;
  }
  async audit(db, subject, id, action) {
    await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
      VALUES($1,$2,'invitation',$3,'success',$4)`, [subject, action, id, randomUUID()]);
  }
  async create(principal, org, body) {
    const input = validateInvitation(body);
    // Authorize before any external identity side effect, then recheck in transaction.
    const realm = await this.transaction(db => this.permittedSites(db, principal.subject, org, input.siteIds, principal.realm));
    const user = await this.identity.prepareUser(input.email, realm);
    const id = randomUUID();
    await this.transaction(async db => {
      await this.permittedSites(db, principal.subject, org, input.siteIds, principal.realm);
      await db.query(`INSERT INTO organisation_invitations(id,organisation_id,email,subject,role,site_ids,state,created_by,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,'pending_delivery',$7,now()+interval '24 hours')`,
      [id, org, input.email, user.subject, input.role, input.siteIds, principal.subject]);
      await this.audit(db, principal.subject, id, 'invitation.created');
    });
    try {
      await this.identity.sendActions(user.subject, user.created, realm);
      await this.transaction(async db => {
        const updated = await db.query(`UPDATE organisation_invitations SET state='sent'
          WHERE id=$1 AND state='pending_delivery' RETURNING id`, [id]);
        if (!updated.rows.length) throw new ApiError(409, 'invitation_unavailable', 'Invitation was revoked.');
        await this.audit(db, principal.subject, id, 'invitation.email_dispatched');
      });
      return { id, state: 'sent', expiresInSeconds: 86400 };
    } catch {
      await this.transaction(async db => {
        await db.query(`UPDATE organisation_invitations SET state='delivery_failed' WHERE id=$1 AND state='pending_delivery'`, [id]);
        await this.audit(db, principal.subject, id, 'invitation.email_unconfirmed');
      });
      throw new ApiError(503, 'invitation_delivery_failed', 'Invitation email was not confirmed sent. No membership granted.');
    }
  }
  async list(principal) {
    if (!principal.emailVerified) return [];
    const { rows } = await this.pool.query(`SELECT i.id,i.organisation_id AS "organisationId",i.role,i.site_ids AS "siteIds",i.expires_at AS "expiresAt"
      FROM organisation_invitations i JOIN organisations o ON o.id=i.organisation_id
      WHERE i.subject=$1 AND i.email=$2 AND i.state='sent' AND i.expires_at>now()
      AND ($3::text IS NULL OR o.openremote_realm=$3)`,
    [principal.subject, principal.email?.toLowerCase(), principal.realm]);
    return rows;
  }
  async accept(principal, id) {
    if (!principal.emailVerified || !principal.email) throw new ApiError(403, 'email_not_verified', 'Verify your email first.');
    return this.transaction(async db => {
      const { rows } = await db.query(`SELECT i.* FROM organisation_invitations i
        JOIN organisations o ON o.id=i.organisation_id WHERE i.id=$1 AND i.subject=$2
        AND i.email=$3 AND i.state='sent' AND i.expires_at>now()
        AND ($4::text IS NULL OR o.openremote_realm=$4) FOR UPDATE OF i`,
      [id, principal.subject, principal.email.toLowerCase(), principal.realm]);
      const invite = rows[0];
      if (!invite) throw new ApiError(404, 'invitation_unavailable', 'Invitation unavailable.');
      // A revoked/suspended inviter cannot leave a usable privilege-granting link.
      const admin = await this.admin(db, invite.created_by, invite.organisation_id, principal.realm);
      const sites = await db.query(`SELECT id FROM sites WHERE organisation_id=$1 AND id=ANY($2::uuid[])
        AND deleted_at IS NULL AND ($3 OR EXISTS(SELECT 1 FROM membership_site_grants g WHERE
          g.organisation_id=$1 AND g.subject=$4 AND g.site_id=sites.id))
        FOR SHARE`, [invite.organisation_id, invite.site_ids, admin.all_sites, invite.created_by]);
      if (sites.rows.length !== invite.site_ids.length) throw new ApiError(409, 'invalid_sites', 'Invited sites changed.');
      const inserted = await db.query(`INSERT INTO organisation_memberships(organisation_id,subject,role,all_sites)
        VALUES($1,$2,$3,false) ON CONFLICT DO NOTHING RETURNING subject`, [invite.organisation_id, principal.subject, invite.role]);
      if (!inserted.rows.length) throw new ApiError(409, 'membership_exists', 'Existing membership is never overwritten by an invitation.');
      for (const site of invite.site_ids) await db.query(`INSERT INTO membership_site_grants(organisation_id,subject,site_id)
        VALUES($1,$2,$3)`, [invite.organisation_id, principal.subject, site]);
      await db.query(`UPDATE organisation_invitations SET state='accepted',accepted_at=now() WHERE id=$1`, [id]);
      await this.audit(db, principal.subject, id, 'invitation.accepted');
      return { accepted: true, organisationId: invite.organisation_id };
    });
  }
  async revoke(principal, org, id) {
    return this.transaction(async db => {
      await this.admin(db, principal.subject, org, principal.realm);
      const { rows } = await db.query(`UPDATE organisation_invitations SET state='revoked'
        WHERE id=$1 AND organisation_id=$2 AND state IN ('sent','pending_delivery','delivery_failed') RETURNING id`, [id, org]);
      if (!rows.length) throw new ApiError(404, 'invitation_unavailable', 'Invitation unavailable.');
      await this.audit(db, principal.subject, id, 'invitation.revoked');
      return { revoked: true };
    });
  }
}
