import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';

const realmPattern = /^[a-z][a-z0-9-]{2,30}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateOrganisationInvitation(input, reservedRealm = 'gridex') {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const realm = typeof input?.realm === 'string' ? input.realm.trim().toLowerCase() : '';
  const email = typeof input?.email === 'string' ? input.email.trim().toLowerCase() : '';
  if (name.length < 3 || name.length > 120 || !realmPattern.test(realm)
      || ['master', reservedRealm].includes(realm) || email.length > 254 || !emailPattern.test(email)) {
    throw new ApiError(400, 'invalid_organisation_invitation', 'Organisation name, unique realm and administrator email are required.');
  }
  return { name, realm, email };
}

// Only the backend holds this credential. It must be a dedicated, audited
// setup client in the master realm; never a browser token or realm password.
export class OpenRemoteRealmSetup {
  constructor(config, fetchImplementation = fetch) { this.config = config; this.fetch = fetchImplementation; }
  async token() {
    const config = this.config;
    if (!config.realmSetupEnabled || !config.realmSetupClientSecret)
      throw new ApiError(503, 'realm_setup_unavailable', 'Organisation provisioning is not configured.');
    const response = await this.fetch(config.realmSetupTokenUrl, {
      method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials',
        client_id: config.realmSetupClientId, client_secret: config.realmSetupClientSecret }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError(503, 'realm_setup_unavailable', 'Realm setup authentication failed.');
    const payload = await response.json();
    if (!payload.access_token) throw new ApiError(503, 'realm_setup_unavailable', 'Realm setup returned no token.');
    return payload.access_token;
  }
  async request(base, path, token, method = 'GET', body) {
    const response = await this.fetch(`${base}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      // Never surface upstream response bodies, which may include account data.
      throw new ApiError(response.status === 409 ? 409 : 503,
        response.status === 409 ? 'realm_setup_conflict' : 'realm_setup_failed',
        'OpenRemote or identity provisioning failed; no organisation was activated.');
    }
    if (response.status === 204 || response.status === 201) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }
  async or(path, token, method = 'GET', body) {
    return this.request(`${this.config.openRemoteBaseUrl}/api/master`, path, token, method, body);
  }
  async kc(path, token, method = 'GET', body) {
    return this.request(this.config.realmSetupAdminBaseUrl, path, token, method, body);
  }
  async createRealm({ realm, name }) {
    if (!this.config.realmSmtpHost || !this.config.realmSmtpPassword)
      throw new ApiError(503, 'realm_email_unavailable', 'Per-realm identity email is not configured.');
    const token = await this.token();
    await this.or('/realm', token, 'POST', { name: realm, displayName: name,
      enabled: true, registrationAllowed: false, verifyEmail: true,
      loginWithEmail: true, registrationEmailAsUsername: true });
    await this.verifyRealm(realm, token);
    const path = `/${encodeURIComponent(realm)}`;
    const existing = await this.kc(path, token);
    await this.kc(path, token, 'PUT', { ...existing,
      smtpServer: { host: this.config.realmSmtpHost, port: this.config.realmSmtpPort,
        from: this.config.realmSmtpFrom, auth: 'true', starttls: 'true',
        user: this.config.realmSmtpUser, password: this.config.realmSmtpPassword } });
    const updated = await this.kc(path, token);
    if (updated?.smtpServer?.host !== this.config.realmSmtpHost
        || updated?.smtpServer?.from !== this.config.realmSmtpFrom)
      throw new ApiError(503, 'realm_email_unverified', 'Per-realm identity email could not be verified.');
    return this.verifyRealm(realm, token);
  }
  async verifyRealm(realm, existingToken) {
    const token = existingToken || await this.token();
    const record = await this.or(`/realm/${encodeURIComponent(realm)}`, token);
    if (record?.name !== realm || record.enabled !== true)
      throw new ApiError(503, 'realm_not_verified', 'The new OpenRemote realm could not be verified.');
    return record;
  }
  async configurePortalClient(realm) {
    const token = await this.token();
    const path = `/${encodeURIComponent(realm)}/clients`;
    const existing = await this.kc(`${path}?clientId=${encodeURIComponent(this.config.oidcAudience)}`, token);
    if (!Array.isArray(existing) || existing.length)
      throw new ApiError(409, 'portal_client_conflict', 'Portal client exists; inspect the realm before retrying.');
    const origin = this.config.portalOrigin;
    await this.kc(path, token, 'POST', { clientId: this.config.oidcAudience,
      protocol: 'openid-connect', enabled: true, publicClient: true,
      standardFlowEnabled: true, directAccessGrantsEnabled: false,
      redirectUris: [`${origin}/*`], webOrigins: [origin],
      attributes: { 'pkce.code.challenge.method': 'S256' },
      protocolMappers: [{ name: 'gridex-api-audience', protocol: 'openid-connect',
        protocolMapper: 'oidc-audience-mapper', config: {
          'included.client.audience': this.config.oidcAudience,
          'access.token.claim': 'true', 'id.token.claim': 'false',
        } }],
    });
    const created = await this.kc(`${path}?clientId=${encodeURIComponent(this.config.oidcAudience)}`, token);
    if (!Array.isArray(created) || created.length !== 1 || !created[0].enabled)
      throw new ApiError(503, 'portal_client_not_verified', 'The realm portal client could not be verified.');
  }
  async prepareUser(realm, email) {
    const token = await this.token();
    const path = `/${encodeURIComponent(realm)}/users`;
    const lookup = `${path}?email=${encodeURIComponent(email)}&exact=true`;
    let users = await this.kc(lookup, token);
    if (!Array.isArray(users) || users.length) throw new ApiError(409, 'identity_conflict', 'Invited identity already exists in this realm.');
    await this.kc(path, token, 'POST', { username: email, email, enabled: true,
      emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] });
    users = await this.kc(lookup, token);
    if (!Array.isArray(users) || users.length !== 1 || !users[0].enabled
        || users[0].email?.toLowerCase() !== email || !users[0].id)
      throw new ApiError(503, 'identity_not_verified', 'The invited identity could not be verified.');
    return { subject: users[0].id };
  }
  async prepareMemberUser(realm, email) {
    const token = await this.token();
    const path = `/${encodeURIComponent(realm)}/users`;
    const lookup = `${path}?email=${encodeURIComponent(email)}&exact=true`;
    let users = await this.kc(lookup, token);
    if (!Array.isArray(users)) throw new ApiError(503, 'identity_not_verified', 'Identity lookup failed.');
    let created = false;
    if (!users.length) {
      await this.kc(path, token, 'POST', { username: email, email, enabled: true,
        emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] });
      created = true;
      users = await this.kc(lookup, token);
    }
    if (!Array.isArray(users) || users.length !== 1 || !users[0].enabled
        || users[0].email?.toLowerCase() !== email || !users[0].id)
      throw new ApiError(409, 'identity_conflict', 'The invited identity cannot be used.');
    return { subject: users[0].id, created };
  }
  async verifyUser(realm, subject, email) {
    const user = await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}`, await this.token());
    if (user?.id !== subject || !user.enabled || !user.emailVerified || user.email?.toLowerCase() !== email)
      throw new ApiError(409, 'identity_not_verified', 'The administrator identity is not verified.');
  }
  async sendActions(realm, subject) {
    const query = new URLSearchParams({ client_id: this.config.oidcAudience,
      redirect_uri: `${this.config.portalOrigin}/login/?realm=${encodeURIComponent(realm)}`,
      lifespan: '86400' });
    await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}/execute-actions-email?${query}`,
      await this.token(), 'PUT', ['VERIFY_EMAIL', 'UPDATE_PASSWORD']);
  }
  async sendMemberActions(realm, subject, created) {
    const query = new URLSearchParams({ client_id: this.config.oidcAudience,
      redirect_uri: `${this.config.portalOrigin}/login/?realm=${encodeURIComponent(realm)}`,
      lifespan: '86400' });
    await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}/execute-actions-email?${query}`,
      await this.token(), 'PUT', created ? ['VERIFY_EMAIL','UPDATE_PASSWORD'] : ['VERIFY_EMAIL']);
  }
  async grantAdministrator(realm, subject) {
    const token = await this.token();
    const prefix = `/${encodeURIComponent(realm)}`;
    const clients = await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(clients) || clients.length !== 1)
      throw new ApiError(503, 'openremote_client_missing', 'OpenRemote roles are unavailable.');
    const roleNames = ['read:admin','write:admin','read:users','write:user',
      'read:assets','write:assets','write:attributes'];
    const roles = await Promise.all(roleNames.map(name => this.kc(
      `${prefix}/clients/${encodeURIComponent(clients[0].id)}/roles/${encodeURIComponent(name)}`, token)));
    await this.kc(`${prefix}/users/${encodeURIComponent(subject)}/role-mappings/clients/${encodeURIComponent(clients[0].id)}`,
      token, 'POST', roles);
    const actual = await this.kc(`${prefix}/users/${encodeURIComponent(subject)}/role-mappings/clients/${encodeURIComponent(clients[0].id)}`, token);
    if (!Array.isArray(actual) || roleNames.some(name => !actual.some(role => role.name === name)))
      throw new ApiError(503, 'administrator_roles_not_verified', 'OpenRemote administrator roles were not verified.');
  }
}

export class OrganisationOnboarding {
  constructor(pool, setup, platformRealm = 'gridex') {
    this.pool = pool; this.setup = setup; this.platformRealm = platformRealm;
  }
  requirePlatform(principal, recent = true) {
    if (principal.realm !== this.platformRealm || !principal.emailVerified
        || !principal.permissions?.includes('platform:manage'))
      throw new ApiError(403, 'permission_denied', 'Platform administrator required.');
    if (recent && (!Number.isFinite(principal.authTime) || Date.now()/1000 - principal.authTime > 600))
      throw new ApiError(401, 'recent_login_required', 'Sign in again before inviting an organisation administrator.');
  }
  async transaction(work) {
    const db = await this.pool.connect();
    try { await db.query('BEGIN'); const result = await work(db); await db.query('COMMIT'); return result; }
    catch (error) { await db.query('ROLLBACK'); throw error; } finally { db.release(); }
  }
  async audit(db, subject, id, action, result = 'success') {
    await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
      VALUES($1,$2,'organisation_onboarding',$3,$4,$5)`, [subject, action, id, result, randomUUID()]);
  }
  async move(id, from, to, fields = {}) {
    const names = Object.keys(fields);
    const values = [id, from, to, ...names.map(key => fields[key])];
    const updates = names.map((key, i) => `${key}=$${i+4}`);
    const { rows } = await this.pool.query(`UPDATE organisation_onboarding_invitations
      SET state=$3${updates.length ? `,${updates.join(',')}` : ''}
      WHERE id=$1 AND state=$2 RETURNING id`, values);
    if (!rows.length) throw new ApiError(409, 'onboarding_state_changed', 'Organisation onboarding state changed.');
  }
  async create(principal, body) {
    this.requirePlatform(principal);
    const input = validateOrganisationInvitation(body, this.platformRealm);
    const id = randomUUID(), organisationId = randomUUID();
    await this.transaction(async db => {
      const existing = await db.query(`SELECT 1 FROM organisations WHERE openremote_realm=$1`, [input.realm]);
      if (existing.rows.length) throw new ApiError(409, 'realm_exists', 'Realm already belongs to an organisation.');
      await db.query(`INSERT INTO organisation_onboarding_invitations
        (id,organisation_id,realm,name,email,created_by,state,expires_at)
        VALUES($1,$2,$3,$4,$5,$6,'reserved',now()+interval '24 hours')`,
      [id, organisationId, input.realm, input.name, input.email, principal.subject]);
      await this.audit(db, principal.subject, id, 'organisation_invitation.reserved');
    });
    let state = 'reserved';
    try {
      await this.setup.createRealm(input);
      await this.move(id, state, 'realm_ready'); state = 'realm_ready';
      await this.setup.configurePortalClient(input.realm);
      const user = await this.setup.prepareUser(input.realm, input.email);
      await this.move(id, state, 'identity_ready', { subject: user.subject }); state = 'identity_ready';
      await this.setup.sendActions(input.realm, user.subject);
      await this.move(id, state, 'sent', { delivered_at: new Date() }); state = 'sent';
      await this.transaction(db => this.audit(db, principal.subject, id, 'organisation_invitation.email_queued'));
      return { id, realm: input.realm, state, expiresInSeconds: 86400 };
    } catch (error) {
      // A provider timeout after mail submission has an UNKNOWN outcome. Do not
      // retry automatically or create another identity/realm. Operator review.
      const failed = state === 'identity_ready' ? 'delivery_failed' : 'provisioning_failed';
      await this.pool.query(`UPDATE organisation_onboarding_invitations
        SET state=$2,last_error_code=$3 WHERE id=$1 AND state=$4`,
      [id, failed, error?.code || 'upstream_unconfirmed', state]);
      throw new ApiError(503, 'organisation_onboarding_incomplete',
        'Onboarding needs reconciliation. No organisation membership was activated.');
    }
  }
  async list(principal) {
    if (!principal.emailVerified || !principal.email || !principal.realm) return [];
    const { rows } = await this.pool.query(`SELECT id,organisation_id AS "organisationId",
      realm,name,expires_at AS "expiresAt" FROM organisation_onboarding_invitations
      WHERE subject=$1 AND email=$2 AND realm=$3 AND state='sent' AND expires_at>now()`,
    [principal.subject, principal.email.toLowerCase(), principal.realm]);
    return rows;
  }
  async listCreated(principal) {
    this.requirePlatform(principal, false);
    const { rows } = await this.pool.query(`SELECT id,realm,name,email,state,
      expires_at AS "expiresAt",created_at AS "createdAt"
      FROM organisation_onboarding_invitations WHERE created_by=$1
      ORDER BY created_at DESC LIMIT 50`, [principal.subject]);
    return rows;
  }
  async revoke(principal, id) {
    this.requirePlatform(principal);
    return this.transaction(async db => {
      const { rows } = await db.query(`UPDATE organisation_onboarding_invitations
        SET state='revoked' WHERE id=$1 AND created_by=$2
        AND state IN ('reserved','realm_ready','identity_ready','sent','delivery_failed','provisioning_failed')
        RETURNING id`, [id, principal.subject]);
      if (!rows.length) throw new ApiError(404, 'invitation_unavailable', 'Invitation cannot be revoked.');
      await this.audit(db, principal.subject, id, 'organisation_invitation.revoked');
      return { revoked: true };
    });
  }
  async accept(principal, id) {
    if (!principal.emailVerified || !principal.email || !principal.realm)
      throw new ApiError(403, 'email_not_verified', 'Verify your email first.');
    const { rows } = await this.pool.query(`SELECT * FROM organisation_onboarding_invitations
      WHERE id=$1 AND subject=$2 AND email=$3 AND realm=$4
      AND state='sent' AND expires_at>now()`,
    [id, principal.subject, principal.email.toLowerCase(), principal.realm]);
    const invite = rows[0];
    if (!invite) throw new ApiError(404, 'invitation_unavailable', 'Invitation unavailable.');
    await this.setup.verifyRealm(invite.realm);
    await this.setup.verifyUser(invite.realm, principal.subject, invite.email);
    await this.transaction(async db => {
      const claimed = await db.query(`UPDATE organisation_onboarding_invitations SET state='activating'
        WHERE id=$1 AND state='sent' AND expires_at>now() RETURNING id`, [id]);
      if (!claimed.rows.length) throw new ApiError(409, 'invitation_unavailable', 'Invitation was already used.');
      await db.query(`INSERT INTO organisations(id,name,openremote_realm,status)
        VALUES($1,$2,$3,'suspended')`, [invite.organisation_id, invite.name, invite.realm]);
      await db.query(`INSERT INTO organisation_memberships(organisation_id,subject,role,all_sites)
        VALUES($1,$2,'administrator',true)`, [invite.organisation_id, principal.subject]);
      await this.audit(db, principal.subject, id, 'organisation_invitation.activation_started', 'pending');
    });
    try {
      await this.setup.grantAdministrator(invite.realm, principal.subject);
      await this.setup.verifyRealm(invite.realm);
      await this.transaction(async db => {
        const result = await db.query(`UPDATE organisation_onboarding_invitations
          SET state='accepted',accepted_at=now() WHERE id=$1 AND state='activating' RETURNING id`, [id]);
        if (!result.rows.length) throw new ApiError(409, 'onboarding_state_changed', 'Activation state changed.');
        await db.query(`UPDATE organisations SET status='active',updated_at=now()
          WHERE id=$1 AND status='suspended'`, [invite.organisation_id]);
        await this.audit(db, principal.subject, id, 'organisation_invitation.accepted');
      });
      return { accepted: true, organisationId: invite.organisation_id, realm: invite.realm };
    } catch {
      await this.pool.query(`UPDATE organisation_onboarding_invitations
        SET state='activation_failed',last_error_code='activation_unconfirmed'
        WHERE id=$1 AND state='activating'`, [id]);
      throw new ApiError(503, 'organisation_activation_incomplete',
        'Organisation activation needs reconciliation; portal access remains suspended.');
    }
  }
}
