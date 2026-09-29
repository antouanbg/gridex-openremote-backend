import { createHash, randomBytes } from 'node:crypto';
import { ApiError } from './errors.mjs';

const token = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const validToken = /^[A-Za-z0-9_-]{43}$/;
const cookieName = '__Host-gridex-grafana';
const cookie = value => `${cookieName}=${value}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=900`;
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export class GrafanaLaunch {
  constructor(pool, origin, config, market) {
    this.pool = pool;
    this.origin = origin;
    this.config = config;
    this.market = market;
  }

  async invalidateAll() {
    await this.pool.query('DELETE FROM grafana_launch_sessions');
  }

  async revoke(subject, realm) {
    await this.pool.query('DELETE FROM grafana_launch_sessions WHERE subject=$1 AND realm=$2', [subject, realm]);
  }

  platform(principal) {
    return principal.emailVerified && principal.realm === this.config.realm
      && this.config.platformAdminSubjects?.has(principal.subject)
      && principal.permissions?.includes('platform:manage');
  }

  async customerOrganisation(subject, realm) {
    const { rows } = await this.pool.query(`SELECT o.id FROM organisations o
      JOIN organisation_memberships m ON m.organisation_id=o.id AND m.subject=$1
      JOIN member_services prices ON prices.organisation_id=o.id
        AND prices.subject=$1 AND prices.service_code='day_ahead'
      JOIN member_services charts ON charts.organisation_id=o.id
        AND charts.subject=$1 AND charts.service_code='visualisations'
      JOIN organisation_market_zones z ON z.organisation_id=o.id
        AND z.service_code='day_ahead' AND z.country='BG' AND z.zone='BG'
      WHERE o.openremote_realm=$2 AND o.status='active' LIMIT 1`, [subject, realm]);
    if (!rows.length || !(await this.market?.isZoneEnabled('BG', 'BG')))
      throw new ApiError(403, 'grafana_access_denied', 'Both services and the BG zone must be enabled.');
    return rows[0].id;
  }

  async issue(principal) {
    if (!principal.emailVerified || !uuid.test(principal.subject ?? ''))
      throw new ApiError(403, 'grafana_access_denied', 'Verified identity required.');
    const organisationId = this.platform(principal) ? null
      : await this.customerOrganisation(principal.subject, principal.realm);
    const oneTimeTicket = token();
    await this.pool.query(`DELETE FROM grafana_launch_sessions
      WHERE (session_expires_at IS NOT NULL AND session_expires_at<now())
         OR (session_hash IS NULL AND expires_at<now())`);
    await this.pool.query(`INSERT INTO grafana_launch_sessions
      (ticket_hash,subject,realm,organisation_id,expires_at)
      VALUES($1,$2,$3,$4,now()+interval '60 seconds')`,
    [hash(oneTimeTicket), principal.subject, principal.realm, organisationId]);
    return { url: `${this.origin}/grafana/launch?ticket=${oneTimeTicket}`, expiresInSeconds: 60 };
  }

  async consume(rawTicket) {
    if (!validToken.test(rawTicket ?? ''))
      throw new ApiError(401, 'invalid_grafana_ticket', 'Invalid or expired dashboard link.');
    const sessionToken = token();
    const { rows } = await this.pool.query(`UPDATE grafana_launch_sessions
      SET session_hash=$2,session_expires_at=now()+interval '15 minutes'
      WHERE ticket_hash=$1 AND session_hash IS NULL AND expires_at>now()
      RETURNING subject,realm,organisation_id`, [hash(rawTicket), hash(sessionToken)]);
    if (!rows.length) throw new ApiError(401, 'invalid_grafana_ticket', 'Invalid or expired dashboard link.');
    await this.authorised(rows[0]);
    return { cookie: cookie(sessionToken) };
  }

  async authorised(session) {
    if (session.organisation_id === null) {
      if (session.realm !== this.config.realm || !this.config.platformAdminSubjects.has(session.subject))
        throw new ApiError(403, 'grafana_access_denied', 'Platform access revoked.');
      return;
    }
    const id = await this.customerOrganisation(session.subject, session.realm);
    if (id !== session.organisation_id)
      throw new ApiError(403, 'grafana_access_denied', 'Organisation access revoked.');
  }

  async check(rawCookie, originalUri) {
    const value = (rawCookie ?? '').split(';').map(part => part.trim())
      .find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!validToken.test(value ?? ''))
      throw new ApiError(401, 'grafana_session_required', 'Open the dashboard from the GrideX portal.');
    const uri = new URL(originalUri || '/', this.origin);
    if (!uri.pathname.startsWith('/grafana/') || uri.pathname.includes('%'))
      throw new ApiError(403, 'grafana_path_denied', 'Dashboard path is not allowed.');
    const { rows } = await this.pool.query(`SELECT subject,realm,organisation_id
      FROM grafana_launch_sessions WHERE session_hash=$1 AND session_expires_at>now() LIMIT 1`, [hash(value)]);
    if (!rows.length) throw new ApiError(403, 'grafana_access_denied', 'Dashboard session expired.');
    await this.authorised(rows[0]);
    return `gridex-${rows[0].subject}`;
  }
}
