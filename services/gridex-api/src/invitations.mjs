import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';

export function validateInvitation(input, { requireNames = true } = {}) {
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  const firstName = typeof input?.firstName === 'string' ? input.firstName.trim().normalize('NFC') : '';
  const lastName = typeof input?.lastName === 'string' ? input.lastName.trim().normalize('NFC') : '';
  const siteIds = input?.siteIds;
  const validName = name => name.length <= 80 && /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name);
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      || ((requireNames || firstName || lastName) && (!validName(firstName) || !validName(lastName)))
      || !['viewer', 'operator', 'energy_manager', 'integrator'].includes(input?.role)
      || !Array.isArray(siteIds) || siteIds.length > 100
      || siteIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))) {
    throw new ApiError(400, 'invalid_invitation', 'First name, last name, email, supported role and explicit siteIds are required.');
  }
  return { firstName, lastName, email, role: input.role, siteIds: [...new Set(siteIds)] };
}

export function validateMemberAccess(input) {
  const role = input?.role;
  const siteIds = input?.siteIds;
  if (!['viewer', 'operator', 'energy_manager', 'integrator'].includes(role)
      || !Array.isArray(siteIds) || siteIds.length > 100
      || siteIds.some(id => typeof id !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)))
    throw new ApiError(400, 'invalid_member_access', 'A supported member role and explicit Site selection are required.');
  return { role, siteIds: [...new Set(siteIds)] };
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
  async prepareUser(email, names) {
    let users = await this.request(`/users?email=${encodeURIComponent(email)}&exact=true`);
    let created = false;
    if (!users.length) {
      await this.request('/users', { method: 'POST', body: JSON.stringify({ username: email, email,
        ...(names?.firstName && names?.lastName ? {firstName:names.firstName,lastName:names.lastName} : {}),
        enabled: true, emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] }) });
      created = true;
      users = await this.request(`/users?email=${encodeURIComponent(email)}&exact=true`);
    }
    if (users.length !== 1 || !users[0].enabled || users[0].email?.toLowerCase() !== email) {
      throw new ApiError(409, 'identity_conflict', 'The invited identity cannot be used.');
    }
    return { subject: users[0].id, created };
  }
  async inspectMemberUser(subject, email) {
    const user = await this.request(`/users/${encodeURIComponent(subject)}`);
    if (user?.id !== subject || !user.enabled || user.email?.toLowerCase() !== email)
      throw new ApiError(409, 'identity_conflict', 'The invited identity no longer matches.');
    return { needsPassword: user.requiredActions?.includes('UPDATE_PASSWORD') === true };
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
  constructor(pool, identity, openRemote = null, memberAccessEnabled = false) {
    this.pool = pool; this.identity = identity; this.openRemote = openRemote;
    this.memberAccessEnabled = memberAccessEnabled;
  }
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
  async scopedAssets(db, org, realm) {
    const { rows } = await db.query(`SELECT s.id AS "siteId",s.openremote_site_asset_id AS "assetId"
      FROM sites s WHERE s.organisation_id=$1 AND s.openremote_realm=$2 AND s.deleted_at IS NULL
      UNION ALL SELECT g.site_id AS "siteId",b.openremote_asset_id AS "assetId"
      FROM gateways g JOIN gateway_openremote_bindings b ON b.gateway_id=g.id
      JOIN sites s ON s.id=g.site_id
      WHERE s.organisation_id=$1 AND s.openremote_realm=$2 AND s.deleted_at IS NULL
      UNION ALL SELECT d.site_id AS "siteId",d.openremote_asset_id AS "assetId"
      FROM devices d JOIN sites s ON s.id=d.site_id
      WHERE s.organisation_id=$1 AND s.openremote_realm=$2 AND s.deleted_at IS NULL
      AND d.deleted_at IS NULL AND d.openremote_asset_id IS NOT NULL`, [org, realm]);
    if (rows.some(row => !row.assetId))
      throw new ApiError(409, 'inventory_reconciliation_required', 'A Site has no verified OpenRemote Asset.');
    return rows;
  }
  async create(principal, org, body) {
    const input = validateInvitation(body, { requireNames: this.memberAccessEnabled });
    // Authorize before any external identity side effect, then recheck in transaction.
    const realm = await this.transaction(db => this.permittedSites(db, principal.subject, org, input.siteIds, principal.realm));
    const user = await this.identity.prepareUser(input.email, realm, input);
    const id = randomUUID();
    await this.transaction(async db => {
      await this.permittedSites(db, principal.subject, org, input.siteIds, principal.realm);
      await db.query(`INSERT INTO organisation_invitations(id,organisation_id,email,subject,role,site_ids,state,created_by,expires_at,first_name,last_name)
        VALUES($1,$2,$3,$4,$5,$6,'pending_delivery',$7,now()+interval '24 hours',$8,$9)`,
      [id, org, input.email, user.subject, input.role, input.siteIds, principal.subject,input.firstName||null,input.lastName||null]);
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
  async listCreated(principal, org) {
    return this.transaction(async db => {
      await this.admin(db, principal.subject, org, principal.realm);
      const { rows } = await db.query(`SELECT id,email,first_name AS "firstName",last_name AS "lastName",role,site_ids AS "siteIds",state,
        expires_at AS "expiresAt",created_at AS "createdAt",accepted_at AS "acceptedAt",
        (SELECT a.last_authenticated_at FROM user_login_activity a JOIN organisations o
          ON o.openremote_realm=a.realm WHERE o.id=organisation_invitations.organisation_id
          AND a.subject=organisation_invitations.subject) AS "lastLoginAt"
        FROM organisation_invitations WHERE organisation_id=$1 AND created_by=$2
        ORDER BY created_at DESC LIMIT 100`, [org, principal.subject]);
      return rows;
    });
  }
  async listMembers(principal, org, { offset = 0, limit = 25, platform = false, search = '' } = {}) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new ApiError(400, 'invalid_page', 'Choose a valid member page.');
    if (typeof search !== 'string' || search.length > 120)
      throw new ApiError(400, 'invalid_search', 'Choose a valid member search.');
    const page = await this.transaction(async db => {
      if (platform) {
        if (!principal.emailVerified || !principal.permissions?.includes('platform:manage'))
          throw new ApiError(403, 'permission_denied', 'Platform administrator required.');
        const organisation = await db.query(`SELECT 1 FROM organisations WHERE id=$1 AND status='active' FOR SHARE`, [org]);
        if (!organisation.rows.length) throw new ApiError(404, 'organisation_unavailable', 'Organisation unavailable.');
      } else await this.admin(db, principal.subject, org, principal.realm);
      const { rows } = await db.query(`SELECT m.subject,m.role,m.all_sites AS "allSites",COUNT(*) OVER() AS total,
        COALESCE(i.email,oi.email) AS email,i.first_name AS "firstName",i.last_name AS "lastName",
        CASE WHEN m.all_sites THEN ARRAY(SELECT s.id FROM sites s WHERE s.organisation_id=m.organisation_id
          AND s.deleted_at IS NULL ORDER BY s.name)
          ELSE ARRAY(SELECT g.site_id FROM membership_site_grants g JOIN sites s ON s.id=g.site_id
            WHERE g.organisation_id=m.organisation_id AND g.subject=m.subject AND s.deleted_at IS NULL ORDER BY s.name) END AS "siteIds",
        ARRAY(SELECT ms.service_code FROM member_services ms WHERE ms.organisation_id=m.organisation_id
          AND ms.subject=m.subject ORDER BY ms.service_code) AS services,
        a.last_authenticated_at AS "lastLoginAt"
        FROM organisation_memberships m JOIN organisations o ON o.id=m.organisation_id
        LEFT JOIN LATERAL (SELECT email,first_name,last_name FROM organisation_invitations
          WHERE organisation_id=m.organisation_id AND subject=m.subject AND state='accepted'
          ORDER BY accepted_at DESC LIMIT 1) i ON true
        LEFT JOIN LATERAL (SELECT email FROM organisation_onboarding_invitations
          WHERE organisation_id=m.organisation_id AND subject=m.subject AND state='accepted'
          ORDER BY accepted_at DESC LIMIT 1) oi ON true
        LEFT JOIN user_login_activity a ON a.realm=o.openremote_realm AND a.subject=m.subject
        WHERE m.organisation_id=$1 AND ($4='' OR strpos(lower(concat_ws(' ',i.first_name,i.last_name,i.email,oi.email)),lower($4))>0)
        ORDER BY COALESCE(i.email,oi.email,m.subject),m.subject
        LIMIT $2 OFFSET $3`, [org, limit + 1, offset, search.trim()]);
      const sites = await db.query(`SELECT id,name,openremote_site_asset_id AS "assetId" FROM sites
        WHERE organisation_id=$1 AND deleted_at IS NULL ORDER BY name`, [org]);
      const scoped = await this.scopedAssets(db, org, platform
        ? (await db.query('SELECT openremote_realm FROM organisations WHERE id=$1', [org])).rows[0]?.openremote_realm
        : principal.realm);
      return { members: rows.slice(0, limit).map(({total,...member})=>member), total:Number(rows[0]?.total || 0), sites: sites.rows, scoped,
        nextOffset: rows.length > limit ? offset + limit : null };
    });
    if (!this.openRemote || !this.identity.assetLinkCredentials)
      throw new ApiError(503, 'inventory_unavailable', 'OpenRemote access verification is unavailable.');
    const realm = platform
      ? (await this.pool.query('SELECT openremote_realm FROM organisations WHERE id=$1', [org])).rows[0]?.openremote_realm
      : principal.realm;
    const credentials = await this.identity.assetLinkCredentials(realm);
    const scopedBySite = new Map(page.sites.map(site => [site.id,
      page.scoped.filter(asset => asset.siteId === site.id).map(asset => asset.assetId)]));
    const realmLinks = await this.openRemote.realmUserAssetLinks(credentials.token, realm, credentials.apiRealm);
    const members = [];
    for (const member of page.members) {
      const links = realmLinks.filter(link => link?.id?.userId === member.subject);
      const linked = new Set(links.map(link => link?.id?.assetId));
      const verifiedSiteIds = member.siteIds.filter(siteId =>
        scopedBySite.get(siteId)?.length && scopedBySite.get(siteId).every(id => linked.has(id)));
      members.push({ ...member, verifiedSiteIds });
    }
    return { members, sites: page.sites.map(({ id, name }) => ({ id, name })), nextOffset: page.nextOffset, total:page.total };
  }

  async updateMember(principal, org, subject, body) {
    const input = validateMemberAccess(body);
    if (!subject || subject.length > 256 || !this.openRemote)
      throw new ApiError(503, 'member_access_unavailable', 'Member access administration is unavailable.');
    const changed = [];
    let assetIds = new Set();
    let realm = null;
    let credentials = null;
    try {
      return await this.transaction(async db => {
        const admin = await this.admin(db, principal.subject, org, principal.realm);
        realm = admin.realm;
        const target = await db.query(`SELECT role FROM organisation_memberships
          WHERE organisation_id=$1 AND subject=$2 FOR UPDATE`, [org, subject]);
        if (!target.rows.length) throw new ApiError(404, 'member_not_found', 'Member not found.');
        if (target.rows[0].role === 'administrator')
          throw new ApiError(403, 'administrator_protected', 'Administrator access is managed separately.');
        credentials = await this.identity.assetLinkCredentials(realm);
        await this.permittedSites(db, principal.subject, org, input.siteIds, principal.realm);
        const sites = await db.query(`SELECT id,openremote_site_asset_id AS "assetId" FROM sites
          WHERE organisation_id=$1 AND openremote_realm=$2 AND deleted_at IS NULL FOR SHARE`, [org, realm]);
        const byId = new Map(sites.rows.map(site => [site.id, site.assetId]));
        if (input.siteIds.some(id => !byId.get(id)))
          throw new ApiError(409, 'site_not_provisioned', 'A selected Site is not verified in OpenRemote.');
        const scoped = await this.scopedAssets(db, org, realm);
        assetIds = new Set(scoped.map(row => row.assetId));
        const readLinks = async () => {
          const links = await this.openRemote.userAssetLinks(subject, credentials.token, realm, credentials.apiRealm);
          if (!Array.isArray(links)) throw new ApiError(503, 'inventory_unavailable', 'OpenRemote Asset links could not be verified.');
          return new Set(links.map(link => link?.id?.assetId).filter(id => assetIds.has(id)));
        };
        const previous = await readLinks();
        const desired = new Set(scoped.filter(row => input.siteIds.includes(row.siteId)).map(row => row.assetId));
        for (const id of previous) if (!desired.has(id)) {
          await this.openRemote.deleteUserAssetLink(id, subject, credentials.token, realm, credentials.apiRealm);
          changed.push({ id, action: 'deleted' });
        }
        for (const id of desired) if (!previous.has(id)) {
          await this.openRemote.linkUserAsset(id, subject, credentials.token, realm, credentials.apiRealm);
          changed.push({ id, action: 'linked' });
        }
        const actual = await readLinks();
        if (actual.size !== desired.size || [...desired].some(id => !actual.has(id)))
          throw new ApiError(409, 'access_reconciliation_required', 'OpenRemote Asset links did not match the requested scope.');
        await db.query(`UPDATE organisation_memberships SET role=$3,all_sites=false
          WHERE organisation_id=$1 AND subject=$2`, [org, subject, input.role]);
        await db.query(`DELETE FROM membership_site_grants WHERE organisation_id=$1 AND subject=$2`, [org, subject]);
        for (const siteId of input.siteIds) await db.query(`INSERT INTO membership_site_grants(organisation_id,subject,site_id)
          VALUES($1,$2,$3)`, [org, subject, siteId]);
        await this.audit(db, principal.subject, subject, 'member.access_updated');
        return { subject, role: input.role, siteIds: input.siteIds };
      });
    } catch (error) {
      try {
        for (const operation of changed.reverse()) {
          if (operation.action === 'linked') await this.openRemote.deleteUserAssetLink(operation.id, subject, credentials.token, realm, credentials.apiRealm);
          else await this.openRemote.linkUserAsset(operation.id, subject, credentials.token, realm, credentials.apiRealm);
        }
      } catch {
        throw new ApiError(503, 'access_reconciliation_required', 'OpenRemote access needs reconciliation; no success was reported.');
      }
      throw error;
    }
  }
  async resendToRecipient(email) {
    const { rows } = await this.pool.query(`UPDATE organisation_invitations i
      SET recipient_resend_used_at=now() FROM organisations o
      WHERE o.id=i.organisation_id AND i.email=$1 AND i.state='sent'
      AND i.recipient_resend_used_at IS NULL
      RETURNING i.id,i.subject,i.email,o.openremote_realm AS realm`, [email]);
    for (const invite of rows) {
      try {
        const inspected=await this.identity.inspectMemberUser(invite.subject, invite.email, invite.realm);
        await this.identity.sendActions(invite.subject, inspected.needsPassword, invite.realm);
        await this.pool.query(`UPDATE organisation_invitations SET expires_at=now()+interval '24 hours'
          WHERE id=$1 AND state='sent'`, [invite.id]);
      } catch (error) {
        console.error('Recipient membership invitation resend failed', { id: invite.id, cause: error?.message });
      }
    }
  }
  async resend(principal, org, id) {
    const invite = await this.transaction(async db => {
      await this.admin(db, principal.subject, org, principal.realm);
      const { rows } = await db.query(`SELECT subject,email,site_ids AS "siteIds" FROM organisation_invitations
        WHERE id=$1 AND organisation_id=$2 AND created_by=$3 AND state='sent' FOR UPDATE`,
      [id, org, principal.subject]);
      if (!rows.length) throw new ApiError(404, 'invitation_unavailable', 'Only a sent invitation can be resent.');
      await this.permittedSites(db, principal.subject, org, rows[0].siteIds, principal.realm);
      await db.query(`UPDATE organisation_invitations SET state='pending_delivery' WHERE id=$1 AND state='sent'`, [id]);
      await this.audit(db, principal.subject, id, 'invitation.resend_started');
      return rows[0];
    });
    try {
      const inspected = await this.identity.inspectMemberUser(invite.subject, invite.email, principal.realm);
      await this.identity.sendActions(invite.subject, inspected.needsPassword, principal.realm);
      return await this.transaction(async db => {
        const { rows } = await db.query(`UPDATE organisation_invitations
          SET state='sent',expires_at=now()+interval '24 hours'
          WHERE id=$1 AND organisation_id=$2 AND created_by=$3 AND state='pending_delivery'
          RETURNING id,state,expires_at AS "expiresAt"`, [id, org, principal.subject]);
        if (!rows.length) throw new ApiError(409, 'invitation_unavailable', 'Invitation was revoked.');
        await this.audit(db, principal.subject, id, 'invitation.resent');
        return rows[0];
      });
    } catch {
      await this.transaction(async db => {
        await db.query(`UPDATE organisation_invitations SET state='delivery_failed'
          WHERE id=$1 AND organisation_id=$2 AND state='pending_delivery'`, [id, org]);
        await this.audit(db, principal.subject, id, 'invitation.resend_unconfirmed');
      });
      throw new ApiError(503, 'invitation_resend_unconfirmed', 'Resend was not confirmed; inspect status before retrying.');
    }
  }
  async accept(principal, id) {
    if (!principal.emailVerified || !principal.email) throw new ApiError(403, 'email_not_verified', 'Verify your email first.');
    const newlyLinked = [];
    let credentials = null;
    let realm = null;
    try {
    return await this.transaction(async db => {
      const { rows } = await db.query(`SELECT i.* FROM organisation_invitations i
        JOIN organisations o ON o.id=i.organisation_id WHERE i.id=$1 AND i.subject=$2
        AND i.email=$3 AND i.state='sent' AND i.expires_at>now()
        AND ($4::text IS NULL OR o.openremote_realm=$4) FOR UPDATE OF i`,
      [id, principal.subject, principal.email.toLowerCase(), principal.realm]);
      const invite = rows[0];
      if (!invite) throw new ApiError(404, 'invitation_unavailable', 'Invitation unavailable.');
      // A revoked/suspended inviter cannot leave a usable privilege-granting link.
      const admin = await this.admin(db, invite.created_by, invite.organisation_id, principal.realm);
      realm = admin.realm;
      const sites = await db.query(`SELECT id FROM sites WHERE organisation_id=$1 AND id=ANY($2::uuid[])
        AND deleted_at IS NULL AND ($3 OR EXISTS(SELECT 1 FROM membership_site_grants g WHERE
          g.organisation_id=$1 AND g.subject=$4 AND g.site_id=sites.id))
        FOR SHARE`, [invite.organisation_id, invite.site_ids, admin.all_sites, invite.created_by]);
      if (sites.rows.length !== invite.site_ids.length) throw new ApiError(409, 'invalid_sites', 'Invited sites changed.');
      if (this.memberAccessEnabled) {
        if (!this.identity.ensureRestrictedReader)
          throw new ApiError(503, 'human_roles_unavailable', 'OpenRemote role provisioning is unavailable.');
        await this.identity.ensureRestrictedReader(realm, principal.subject);
      }
      if (this.memberAccessEnabled && invite.site_ids.length) {
        if (!this.openRemote || !this.identity.assetLinkCredentials)
          throw new ApiError(503, 'inventory_unavailable', 'OpenRemote access verification is unavailable.');
        const assets = await db.query(`SELECT id,openremote_site_asset_id AS "assetId" FROM sites
          WHERE organisation_id=$1 AND openremote_realm=$2 AND id=ANY($3::uuid[]) AND deleted_at IS NULL FOR SHARE`,
        [invite.organisation_id, realm, invite.site_ids]);
        if (assets.rows.length !== invite.site_ids.length || assets.rows.some(site => !site.assetId))
          throw new ApiError(409, 'site_not_provisioned', 'Invited Sites are not provisioned in OpenRemote.');
        const scoped = await this.scopedAssets(db, invite.organisation_id, realm);
        const desired = new Set(scoped.filter(row => invite.site_ids.includes(row.siteId)).map(row => row.assetId));
        credentials = await this.identity.assetLinkCredentials(realm);
        const before = await this.openRemote.userAssetLinks(principal.subject, credentials.token, realm, credentials.apiRealm);
        if (!Array.isArray(before)) throw new ApiError(503, 'inventory_unavailable', 'OpenRemote Asset links could not be verified.');
        const previous = new Set(before.map(link => link?.id?.assetId));
        for (const assetId of desired) if (!previous.has(assetId)) {
          await this.openRemote.linkUserAsset(assetId, principal.subject, credentials.token, realm, credentials.apiRealm);
          newlyLinked.push(assetId);
        }
        const after = await this.openRemote.userAssetLinks(principal.subject, credentials.token, realm, credentials.apiRealm);
        if (!Array.isArray(after) || [...desired].some(id => !after.some(link => link?.id?.assetId === id)))
          throw new ApiError(409, 'access_reconciliation_required', 'OpenRemote Asset links did not match the invitation.');
      }
      const inserted = await db.query(`INSERT INTO organisation_memberships(organisation_id,subject,role,all_sites)
        VALUES($1,$2,$3,false) ON CONFLICT DO NOTHING RETURNING subject`, [invite.organisation_id, principal.subject, invite.role]);
      if (!inserted.rows.length) throw new ApiError(409, 'membership_exists', 'Existing membership is never overwritten by an invitation.');
      for (const site of invite.site_ids) await db.query(`INSERT INTO membership_site_grants(organisation_id,subject,site_id)
        VALUES($1,$2,$3)`, [invite.organisation_id, principal.subject, site]);
      await db.query(`UPDATE organisation_invitations SET state='accepted',accepted_at=now() WHERE id=$1`, [id]);
      await this.audit(db, principal.subject, id, 'invitation.accepted');
      return { accepted: true, organisationId: invite.organisation_id };
    });
    } catch (error) {
      try {
        for (const assetId of newlyLinked.reverse())
          await this.openRemote.deleteUserAssetLink(assetId, principal.subject, credentials.token, realm, credentials.apiRealm);
      } catch {
        throw new ApiError(503, 'access_reconciliation_required', 'OpenRemote access needs reconciliation; no success was reported.');
      }
      throw error;
    }
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
