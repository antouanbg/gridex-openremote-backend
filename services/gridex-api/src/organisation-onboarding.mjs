import { randomUUID, randomBytes } from 'node:crypto';
import { ApiError } from './errors.mjs';

const realmPattern = /^[a-z][a-z0-9-]{2,30}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const assetServiceClientId = 'gridex-realm-assets';
const assetServiceRoles = ['read:assets', 'write:assets'];

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
  constructor(config, fetchImplementation = fetch) {
    this.config = config; this.fetch = fetchImplementation; this.assetTokens = new Map();
  }
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
  async assetServiceIdentity(realm, token) {
    if (!realmPattern.test(realm) || realm === 'master')
      throw new ApiError(400, 'invalid_realm', 'Asset service requires an organisation realm.');
    const prefix = `/${encodeURIComponent(realm)}`;
    const clients = await this.kc(`${prefix}/clients?clientId=${assetServiceClientId}`, token);
    if (!Array.isArray(clients) || clients.length !== 1 || clients[0].clientId !== assetServiceClientId
        || !clients[0].id || !clients[0].enabled || clients[0].publicClient
        || !clients[0].serviceAccountsEnabled || clients[0].standardFlowEnabled
        || clients[0].directAccessGrantsEnabled)
      throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service is not safely configured.');
    const orClients = await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(orClients) || orClients.length !== 1 || !orClients[0].id)
      throw new ApiError(503, 'asset_service_unavailable', 'OpenRemote role client is unavailable.');
    const serviceUser = await this.kc(`${prefix}/clients/${clients[0].id}/service-account-user`, token);
    if (!serviceUser?.id) throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service identity is unavailable.');
    const roles = await this.kc(`${prefix}/users/${serviceUser.id}/role-mappings/clients/${orClients[0].id}/composite`, token);
    const realmRoles = await this.kc(`${prefix}/users/${serviceUser.id}/role-mappings/realm/composite`, token);
    const names = new Set(Array.isArray(roles) ? roles.map(role => role.name) : []);
    if (assetServiceRoles.some(name => !names.has(name))
        || [...names].some(name => !assetServiceRoles.includes(name))
        || !Array.isArray(realmRoles) || realmRoles.some(role => ['admin', 'superuser', 'restricted_user'].includes(role.name)))
      throw new ApiError(503, 'asset_service_scope_invalid', 'Realm Asset service roles do not match the approved scope.');
    return { prefix, client: clients[0], openRemoteClient: orClients[0], serviceUser };
  }
  async provisionAssetServiceClient(realm) {
    const token = await this.token();
    await this.verifyRealm(realm, token);
    const prefix = `/${encodeURIComponent(realm)}`;
    let clients = await this.kc(`${prefix}/clients?clientId=${assetServiceClientId}`, token);
    if (!Array.isArray(clients) || clients.length > 1)
      throw new ApiError(503, 'asset_service_conflict', 'Realm Asset service requires manual reconciliation.');
    if (!clients.length) {
      await this.kc(`${prefix}/clients`, token, 'POST', {
        clientId: assetServiceClientId, protocol: 'openid-connect', enabled: true,
        secret: randomBytes(32).toString('hex'), publicClient: false,
        serviceAccountsEnabled: true, standardFlowEnabled: false,
        directAccessGrantsEnabled: false, fullScopeAllowed: true,
        protocolMappers: [{ name: 'openremote-audience', protocol: 'openid-connect',
          protocolMapper: 'oidc-audience-mapper', config: {
            'included.client.audience': 'openremote', 'access.token.claim': 'true',
            'id.token.claim': 'false',
          } }],
      });
      clients = await this.kc(`${prefix}/clients?clientId=${assetServiceClientId}`, token);
    }
    if (clients.length !== 1 || clients[0].clientId !== assetServiceClientId || !clients[0].id
        || !clients[0].enabled || clients[0].publicClient || !clients[0].serviceAccountsEnabled
        || clients[0].standardFlowEnabled || clients[0].directAccessGrantsEnabled)
      throw new ApiError(503, 'asset_service_conflict', 'Existing realm Asset client is not approved.');
    const orClients = await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(orClients) || orClients.length !== 1 || !orClients[0].id)
      throw new ApiError(503, 'asset_service_unavailable', 'OpenRemote role client is unavailable.');
    const serviceUser = await this.kc(`${prefix}/clients/${clients[0].id}/service-account-user`, token);
    if (!serviceUser?.id) throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service identity is unavailable.');
    const rolePath = `${prefix}/users/${serviceUser.id}/role-mappings/clients/${orClients[0].id}`;
    const before = await this.kc(`${rolePath}/composite`, token);
    if (!Array.isArray(before) || before.some(role => !assetServiceRoles.includes(role.name)))
      throw new ApiError(503, 'asset_service_scope_invalid', 'Existing realm Asset client has unexpected roles.');
    const missing = assetServiceRoles.filter(name => !before.some(role => role.name === name));
    if (missing.length) {
      const roles = await Promise.all(missing.map(name => this.kc(
        `${prefix}/clients/${orClients[0].id}/roles/${encodeURIComponent(name)}`, token)));
      await this.kc(rolePath, token, 'POST', roles);
    }
    await this.assetServiceIdentity(realm, token);
    this.assetTokens.delete(realm);
    return { realm, clientId: assetServiceClientId, verified: true };
  }
  async assetServiceCredentials(realm) {
    const cached = this.assetTokens.get(realm);
    if (cached && cached.expiresAt > Date.now() + 30000)
      return { token: cached.token, apiRealm: realm };
    const adminToken = await this.token();
    const identity = await this.assetServiceIdentity(realm, adminToken);
    const secret = await this.kc(`${identity.prefix}/clients/${identity.client.id}/client-secret`, adminToken);
    if (!secret?.value) throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service secret is unavailable.');
    const tokenUrl = this.config.realmSetupTokenUrl.replace('/realms/master/', `/realms/${encodeURIComponent(realm)}/`);
    if (tokenUrl === this.config.realmSetupTokenUrl)
      throw new ApiError(503, 'asset_service_unavailable', 'Realm token endpoint is not configured.');
    const response = await this.fetch(tokenUrl, {
      method: 'POST', body: new URLSearchParams({ grant_type: 'client_credentials',
        client_id: assetServiceClientId, client_secret: secret.value }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service authentication failed.');
    const payload = await response.json();
    if (!payload.access_token) throw new ApiError(503, 'asset_service_unavailable', 'Realm Asset service returned no token.');
    let claims;
    try { claims = JSON.parse(Buffer.from(payload.access_token.split('.')[1] || '', 'base64url').toString('utf8')); }
    catch { throw new ApiError(503, 'asset_service_scope_invalid', 'Realm Asset token could not be verified.'); }
    const roles = claims.resource_access?.openremote?.roles || [];
    const issuerRealm = claims.iss?.split('/realms/')[1];
    if (issuerRealm !== realm || claims.azp !== assetServiceClientId
        || !assetServiceRoles.every(role => roles.includes(role))
        || roles.some(role => !assetServiceRoles.includes(role)))
      throw new ApiError(503, 'asset_service_scope_invalid', 'Realm Asset token scope was not verified.');
    this.assetTokens.set(realm, { token: payload.access_token,
      expiresAt: Date.now() + Number(payload.expires_in || 60) * 1000 });
    return { token: payload.access_token, apiRealm: realm };
  }
  async ensureRestrictedReader(realm, subject) {
    if (!realmPattern.test(realm) || !/^[0-9a-f-]{36}$/i.test(subject))
      throw new ApiError(400, 'invalid_identity', 'A realm and verified user are required.');
    const token = await this.token();
    const prefix = `/${encodeURIComponent(realm)}`;
    const user = await this.kc(`${prefix}/users/${encodeURIComponent(subject)}`, token);
    if (user?.id !== subject || !user.enabled)
      throw new ApiError(409, 'identity_conflict', 'The member identity cannot be verified.');
    const clients = await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(clients) || clients.length !== 1 || !clients[0].id)
      throw new ApiError(503, 'openremote_client_missing', 'OpenRemote roles are unavailable.');
    const realmPath = `${prefix}/users/${subject}/role-mappings/realm`;
    const realmRoles = await this.kc(`${realmPath}/composite`, token);
    const clientPath = `${prefix}/users/${subject}/role-mappings/clients/${clients[0].id}`;
    const clientRoles = await this.kc(`${clientPath}/composite`, token);
    if (!Array.isArray(realmRoles) || !Array.isArray(clientRoles)
        || clientRoles.some(role => role.name !== 'read:assets')
        || realmRoles.some(role => ['admin', 'superuser'].includes(role.name)))
      throw new ApiError(409, 'human_roles_conflict', 'The member has direct OpenRemote write or admin roles.');
    if (!realmRoles.some(role => role.name === 'restricted_user')) {
      const restricted = await this.kc(`${prefix}/roles/restricted_user`, token);
      await this.kc(realmPath, token, 'POST', [restricted]);
    }
    if (!clientRoles.some(role => role.name === 'read:assets')) {
      const read = await this.kc(`${prefix}/clients/${clients[0].id}/roles/read%3Aassets`, token);
      await this.kc(clientPath, token, 'POST', [read]);
    }
    const actualRealm = await this.kc(`${realmPath}/composite`, token);
    const actualClient = await this.kc(`${clientPath}/composite`, token);
    if (!actualRealm.some(role => role.name === 'restricted_user')
        || !actualClient.some(role => role.name === 'read:assets')
        || actualClient.some(role => role.name !== 'read:assets'))
      throw new ApiError(503, 'human_roles_not_verified', 'Restricted OpenRemote read access was not verified.');
    return { realm, subject, verified: true };
  }
  async migrateHumanReader(realm, subject, apply = false) {
    if (!realmPattern.test(realm) || !/^[0-9a-f-]{36}$/i.test(subject))
      throw new ApiError(400, 'invalid_identity', 'A realm and verified user are required.');
    const token = await this.token();
    const prefix = `/${encodeURIComponent(realm)}`;
    const user = await this.kc(`${prefix}/users/${subject}`, token);
    if (user?.id !== subject || !user.enabled || user.serviceAccountClientId)
      throw new ApiError(409, 'identity_conflict', 'Expected an active human identity.');
    const clients = await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(clients) || clients.length !== 1 || !clients[0].id)
      throw new ApiError(503, 'openremote_client_missing', 'OpenRemote roles are unavailable.');
    const path = `${prefix}/users/${subject}/role-mappings/clients/${clients[0].id}`;
    const direct = await this.kc(path, token);
    const composite = await this.kc(`${path}/composite`, token);
    const realmComposite = await this.kc(`${prefix}/users/${subject}/role-mappings/realm/composite`, token);
    const legacy = new Set(['read:admin', 'read:users', 'write:admin', 'write:assets',
      'write:attributes', 'write:user']);
    if (!Array.isArray(direct) || !Array.isArray(composite) || !Array.isArray(realmComposite)
        || direct.some(role => role.name !== 'read:assets' && !legacy.has(role.name))
        || realmComposite.some(role => ['admin', 'superuser'].includes(role.name)))
      throw new ApiError(409, 'human_roles_conflict', 'Human roles require manual review before migration.');
    const removal = direct.filter(role => legacy.has(role.name));
    if (!apply) return { realm, subject, remove: removal.map(role => role.name),
      addRead: !composite.some(role => role.name === 'read:assets'),
      addRestricted: !realmComposite.some(role => role.name === 'restricted_user') };
    if (removal.length) await this.kc(path, token, 'DELETE', removal);
    await this.ensureRestrictedReader(realm, subject);
    const actual = await this.kc(`${path}/composite`, token);
    if (!Array.isArray(actual) || actual.some(role => role.name !== 'read:assets'))
      throw new ApiError(503, 'human_roles_not_verified', 'Human OpenRemote roles are not read-only.');
    // Existing Manager and portal sessions must not keep the old write token.
    await this.kc(`${prefix}/users/${subject}/logout`, token, 'POST');
    return { realm, subject, verified: true, removed: removal.map(role => role.name) };
  }
  async setOrganisationAccess(realm, enabled) {
    if (!realmPattern.test(realm) || ['master', this.config.realm].includes(realm))
      throw new ApiError(403, 'protected_realm', 'The platform realm cannot be changed.');
    const token = await this.token();
    const path = `/${encodeURIComponent(realm)}`;
    const record = await this.or(`/realm${path}`, token);
    if (record?.name !== realm) throw new ApiError(503, 'realm_not_verified', 'Realm identity mismatch.');
    if (!enabled) {
      // Realm-local text also covers direct Keycloak login attempts.
      const messages = {
        en: 'Your organisation is temporarily suspended. Contact the super administrator.',
        bg: 'Организацията е временно спряна. Свържете се със супер администратора.',
      };
      for (const [locale, message] of Object.entries(messages)) {
        const response = await this.fetch(`${this.config.realmSetupAdminBaseUrl}${path}/localization/${locale}/realmNotEnabledMessage`, {
          method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
          body: message, signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new ApiError(503, 'suspension_message_failed', 'Suspension login text could not be configured.');
      }
    }
    // OpenRemote owns realm changes; preserve every existing setting and asset.
    await this.or(`/realm${path}`, token, 'PUT', { ...record, enabled, notBefore: enabled ? record.notBefore : Math.max(Number(record.notBefore) || 0, Math.floor(Date.now()/1000)) });
    if (!enabled) {
      const identitySettings = await this.kc(path, token);
      await this.kc(path, token, 'PUT', { internationalizationEnabled: true,
        supportedLocales: [...new Set([...(identitySettings.supportedLocales || []), 'en', 'bg'])] });
    }
    const actual = await this.or(`/realm${path}`, token);
    const identityRealm = await this.kc(path, token);
    if (actual?.name !== realm || actual.enabled !== enabled || identityRealm?.realm !== realm || identityRealm.enabled !== enabled)
      throw new ApiError(503, 'realm_access_not_verified', 'OpenRemote and Keycloak realm access do not agree.');
    if (!enabled) await this.kc(`${path}/logout-all`, token, 'POST');
  }
  async createRealm({ realm, name }) {
    const token = await this.token();
    await this.or('/realm', token, 'POST', { name: realm, displayName: name,
      enabled: true, registrationAllowed: false, verifyEmail: true,
      loginWithEmail: true, registrationEmailAsUsername: true });
    // The deployed Keycloak EmailSenderProvider uses the shared Mailgun REST
    // configuration, including BCC. Realm-local SMTP credentials are unnecessary.
    const record = await this.verifyRealm(realm, token);
    // The OpenRemote realm keeps the customer name internally. The unauthenticated
    // Keycloak login must not disclose it in its public heading.
    const identityRealm = await this.kc(`/${encodeURIComponent(realm)}`, token);
    if (identityRealm?.realm !== realm) throw new ApiError(503, 'realm_not_verified', 'Identity realm could not be verified.');
    await this.kc(`/${encodeURIComponent(realm)}`, token, 'PUT', {
      ...identityRealm, displayName: 'GrideX', displayNameHtml: '', resetPasswordAllowed: true,
    });
    const publicBrand = await this.kc(`/${encodeURIComponent(realm)}`, token);
    if (publicBrand?.displayName !== 'GrideX' || publicBrand.displayNameHtml || !publicBrand.resetPasswordAllowed)
      throw new ApiError(503, 'public_realm_brand_not_verified', 'The public login branding was not verified.');
    return record;
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
  async prepareMemberUser(realm, email, names) {
    const token = await this.token();
    const path = `/${encodeURIComponent(realm)}/users`;
    const lookup = `${path}?email=${encodeURIComponent(email)}&exact=true`;
    let users = await this.kc(lookup, token);
    if (!Array.isArray(users)) throw new ApiError(503, 'identity_not_verified', 'Identity lookup failed.');
    let created = false;
    if (!users.length) {
      await this.kc(path, token, 'POST', { username: email, email, enabled: true,
        ...(names?.firstName && names?.lastName ? {firstName:names.firstName,lastName:names.lastName} : {}),
        emailVerified: false, requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'] });
      created = true;
      users = await this.kc(lookup, token);
    }
    if (!Array.isArray(users) || users.length !== 1 || !users[0].enabled
        || users[0].email?.toLowerCase() !== email || !users[0].id)
      throw new ApiError(409, 'identity_conflict', 'The invited identity cannot be used.');
    return { subject: users[0].id, created };
  }
  async inspectMemberUser(realm, subject, email) {
    const user = await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}`, await this.token());
    if (user?.id !== subject || !user.enabled || user.email?.toLowerCase() !== email)
      throw new ApiError(409, 'identity_conflict', 'The invited identity no longer matches.');
    return { needsPassword: user.requiredActions?.includes('UPDATE_PASSWORD') === true };
  }
  async verifyUser(realm, subject, email) {
    const user = await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}`, await this.token());
    if (user?.id !== subject || !user.enabled || !user.emailVerified || user.email?.toLowerCase() !== email)
      throw new ApiError(409, 'identity_not_verified', 'The administrator identity is not verified.');
  }
  async verifyPreparedUser(realm, subject, email) {
    const user = await this.kc(`/${encodeURIComponent(realm)}/users/${encodeURIComponent(subject)}`, await this.token());
    if (user?.id !== subject || !user.enabled || user.email?.toLowerCase() !== email)
      throw new ApiError(409, 'identity_not_verified', 'The invited identity no longer matches.');
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
    await this.ensureManagerClient(realm, token, clients[0]);
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
  async ensureManagerClient(realm, existingToken, existingClient) {
    const origin = this.config.managerPublicOrigin;
    if (!origin) return;
    const token = existingToken || await this.token();
    const prefix = `/${encodeURIComponent(realm)}`;
    const clients = existingClient ? [existingClient] : await this.kc(`${prefix}/clients?clientId=openremote`, token);
    if (!Array.isArray(clients) || clients.length !== 1 || !clients[0].id)
      throw new ApiError(503, 'openremote_client_missing', 'OpenRemote browser client is unavailable.');
    const path = `${prefix}/clients/${encodeURIComponent(clients[0].id)}`;
    const before = await this.kc(path, token);
    if (before?.clientId !== 'openremote' || !before.publicClient || !before.standardFlowEnabled)
      throw new ApiError(503, 'openremote_client_invalid', 'OpenRemote browser client must be reviewed.');
    const callback = `${origin}/manager/*`;
    if (!before.redirectUris?.includes(callback) || !before.webOrigins?.includes(origin)) {
      await this.kc(path, token, 'PUT', { ...before,
        redirectUris: [...new Set([...(before.redirectUris || []), callback])],
        webOrigins: [...new Set([...(before.webOrigins || []), origin])] });
    }
    const actual = await this.kc(path, token);
    if (!actual.redirectUris?.includes(callback) || !actual.webOrigins?.includes(origin))
      throw new ApiError(503, 'manager_callback_not_verified', 'OpenRemote Manager callback was not verified.');
  }
}

export class OrganisationOnboarding {
  constructor(pool, setup, platformRealm = 'gridex', scopedAssetsEnabled = false) {
    this.pool = pool; this.setup = setup; this.platformRealm = platformRealm;
    this.scopedAssetsEnabled = scopedAssetsEnabled;
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
      if (this.scopedAssetsEnabled) await this.setup.provisionAssetServiceClient(input.realm);
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
      expires_at AS "expiresAt",created_at AS "createdAt",accepted_at AS "acceptedAt",
      (SELECT a.last_authenticated_at FROM user_login_activity a
        WHERE a.realm=organisation_onboarding_invitations.realm
        AND a.subject=organisation_onboarding_invitations.subject) AS "lastLoginAt"
      FROM organisation_onboarding_invitations WHERE created_by=$1
      ORDER BY created_at DESC LIMIT 50`, [principal.subject]);
    return rows;
  }
  async resendToRecipient(email) {
    const { rows } = await this.pool.query(`UPDATE organisation_onboarding_invitations
      SET recipient_resend_used_at=now() WHERE email=$1 AND state='sent'
      AND recipient_resend_used_at IS NULL RETURNING id,realm,subject,email`, [email]);
    for (const invite of rows) {
      try {
        await this.setup.verifyPreparedUser(invite.realm, invite.subject, invite.email);
        await this.setup.sendActions(invite.realm, invite.subject);
        await this.pool.query(`UPDATE organisation_onboarding_invitations SET expires_at=now()+interval '24 hours'
          WHERE id=$1 AND state='sent'`, [invite.id]);
      } catch (error) {
        console.error('Recipient organisation invitation resend failed', { id: invite.id, cause: error?.message });
      }
    }
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
  async resend(principal, id) {
    this.requirePlatform(principal);
    // Verify the existing realm and exact identity; never create a second user.
    const current = await this.pool.query(`SELECT realm,email,subject FROM organisation_onboarding_invitations
      WHERE id=$1 AND created_by=$2 AND state='sent'`, [id, principal.subject]);
    const invitation = current.rows[0];
    if (!invitation?.subject) throw new ApiError(404, 'invitation_unavailable', 'Only a sent invitation can be resent.');
    await this.setup.verifyRealm(invitation.realm);
    await this.setup.verifyPreparedUser(invitation.realm, invitation.subject, invitation.email);
    // Existing failure state is a durable, fail-closed claim. If the provider's
    // result is uncertain, leave it there for reconciliation; never auto-retry.
    const claimed = await this.pool.query(`UPDATE organisation_onboarding_invitations
      SET state='delivery_failed',last_error_code='resend_in_progress'
      WHERE id=$1 AND created_by=$2 AND state='sent'
      RETURNING id`, [id, principal.subject]);
    if (!claimed.rows.length) throw new ApiError(409, 'onboarding_state_changed', 'Invitation state changed.');
    try {
      await this.setup.sendActions(invitation.realm, invitation.subject);
      const result = await this.transaction(async db => {
        const updated = await db.query(`UPDATE organisation_onboarding_invitations
          SET state='sent',expires_at=now()+interval '24 hours',delivered_at=now(),last_error_code=NULL
          WHERE id=$1 AND created_by=$2 AND state='delivery_failed' AND last_error_code='resend_in_progress'
          RETURNING id,expires_at AS "expiresAt"`, [id, principal.subject]);
        if (!updated.rows.length) throw new ApiError(409, 'onboarding_state_changed', 'Invitation state changed.');
        await this.audit(db, principal.subject, id, 'organisation_invitation.resent');
        return updated.rows[0];
      });
      return { id: result.id, state: 'sent', expiresAt: result.expiresAt };
    } catch (error) {
      await this.pool.query(`UPDATE organisation_onboarding_invitations
        SET last_error_code='resend_unconfirmed'
        WHERE id=$1 AND created_by=$2 AND state='delivery_failed' AND last_error_code='resend_in_progress'`,
      [id, principal.subject]);
      throw new ApiError(503, 'organisation_resend_unconfirmed',
        'The provider result is unconfirmed. Inspect delivery before another attempt.');
    }
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
      if (this.scopedAssetsEnabled) await this.setup.ensureRestrictedReader(invite.realm, principal.subject);
      else await this.setup.grantAdministrator(invite.realm, principal.subject);
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
