import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from './errors.mjs';

const token = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const cookieName = '__Host-gridex-manager';
const cookie = value => `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=900`;
const ticketPattern = /^[A-Za-z0-9_-]{43}$/;

export class ManagerLaunch {
  constructor(pool, origin, platformRealm = 'gridex', platformAdminSubjects = new Set()) {
    this.pool = pool;
    this.origin = origin;
    this.platformRealm = platformRealm;
    this.platformAdminSubjects = platformAdminSubjects;
  }

  async invalidateAll() {
    // The portal requires fresh sign-in after an API restart. Manager sessions
    // must not outlive that boundary either; these are only ephemeral grants.
    await this.pool.query('DELETE FROM manager_launch_sessions');
  }

  async revoke(subject, realm) {
    await this.pool.query('DELETE FROM manager_launch_sessions WHERE subject=$1 AND realm=$2', [subject, realm]);
  }

  async issue(principal) {
    if (!principal.emailVerified || !principal.realm || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(principal.subject ?? ''))
      throw new ApiError(403, 'manager_access_denied', 'Verified identity required.');
    const { rows } = await this.pool.query(`SELECT 1 FROM organisation_memberships m
      JOIN organisations o ON o.id=m.organisation_id AND o.status='active'
      WHERE m.subject=$1 AND o.openremote_realm=$2 AND m.role='administrator' LIMIT 1`,
      [principal.subject, principal.realm]);
    if (!rows.length && !(principal.realm === this.platformRealm && principal.permissions.includes('platform:manage')))
      throw new ApiError(403, 'manager_access_denied', 'Organisation administrator required.');
    const oneTimeTicket = token();
    await this.pool.query(`DELETE FROM manager_launch_sessions
      WHERE (session_expires_at IS NOT NULL AND session_expires_at<now())
         OR (session_hash IS NULL AND expires_at<now())`);
    await this.pool.query(`INSERT INTO manager_launch_sessions(ticket_hash,subject,realm,expires_at)
      VALUES($1,$2,$3,now()+interval '60 seconds')`, [hash(oneTimeTicket), principal.subject, principal.realm]);
    return { url: `${this.origin}/manager/launch?ticket=${oneTimeTicket}`, expiresInSeconds: 60 };
  }

  async consume(rawTicket) {
    if (!ticketPattern.test(rawTicket ?? '')) throw new ApiError(401, 'invalid_manager_ticket', 'Invalid or expired Manager link.');
    const sessionToken = token();
    const { rows } = await this.pool.query(`UPDATE manager_launch_sessions
      SET session_hash=$2,session_expires_at=now()+interval '15 minutes'
      WHERE ticket_hash=$1 AND session_hash IS NULL AND expires_at>now()
      RETURNING realm`, [hash(rawTicket), hash(sessionToken)]);
    if (!rows.length) throw new ApiError(401, 'invalid_manager_ticket', 'Invalid or expired Manager link.');
    return { realm: rows[0].realm, cookie: cookie(sessionToken) };
  }

  async check(rawCookie, originalUri) {
    const value = (rawCookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!ticketPattern.test(value ?? '')) throw new ApiError(401, 'manager_session_required', 'Open Manager from the GrideX portal.');
    const { rows } = await this.pool.query(`SELECT s.realm FROM manager_launch_sessions s
      WHERE s.session_hash=$1 AND s.session_expires_at>now()
      AND (EXISTS (SELECT 1 FROM organisation_memberships m
          JOIN organisations o ON o.id=m.organisation_id AND o.openremote_realm=s.realm AND o.status='active'
          WHERE m.subject=s.subject AND m.role='administrator')
        OR (s.realm=$2 AND s.subject=ANY($3::text[])
          AND EXISTS (SELECT 1 FROM organisations o WHERE o.openremote_realm=$2 AND o.status='active')))
      LIMIT 1`, [hash(value), this.platformRealm, [...this.platformAdminSubjects]]);
    if (!rows.length) throw new ApiError(403, 'manager_access_denied', 'Manager access is no longer active.');
    const realm = rows[0].realm;
    const uri = new URL(originalUri || '/', this.origin);
    // The proxy's route matcher normalises escaped path segments. Reject them
    // instead of interpreting the unnormalised original differently here.
    const fontPath = /^\/shared\/fonts\/(?:[A-Za-z0-9,_-]|%20)+\/\d+-\d+\.pbf$/.test(uri.pathname);
    if (uri.pathname.includes('%') && !fontPath) throw new ApiError(403, 'manager_path_denied', 'Encoded Manager path is not allowed.');
    if (!uri.pathname.startsWith('/manager/') && !uri.pathname.startsWith('/shared/')
        && uri.pathname !== '/websocket/events'
        && uri.pathname !== '/api/master/info'
        && uri.pathname !== '/api/master/configuration/manager'
        && !/^\/api\/[a-z][a-z0-9-]{2,30}\//.test(uri.pathname))
      throw new ApiError(403, 'manager_path_denied', 'Manager path is not allowed.');
    if (uri.pathname === '/manager/' && uri.searchParams.get('realm') !== realm)
      throw new ApiError(403, 'manager_realm_denied', 'Wrong organisation.');
    // The Manager bootstraps through two synthetic /api/master responses.
    // Nginx routes those exact paths to this API, never to OpenRemote master.
    const bootstrapPath = uri.pathname === '/api/master/info'
      || uri.pathname === '/api/master/configuration/manager';
    const apiRealm = uri.pathname.match(/^\/api\/([a-z][a-z0-9-]{2,30})\//)?.[1];
    if (apiRealm && !bootstrapPath && (apiRealm === 'master' || apiRealm !== realm))
      throw new ApiError(403, 'manager_realm_denied', 'Wrong organisation.');
    const userRealm=uri.pathname.match(/^\/api\/[^/]+\/user\/([^/]+)\/userRealmRoles\//)?.[1];
    if ((userRealm && userRealm !== realm) ||
        (apiRealm && uri.searchParams.has('realm') && uri.searchParams.get('realm') !== realm))
      throw new ApiError(403, 'manager_realm_denied', 'Wrong organisation.');
    return realm;
  }
}
