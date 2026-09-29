import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { MARKET_ZONES } from './market-prices.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const serviceCode = /^[a-z][a-z0-9_]{1,63}$/;

export class ServiceEntitlements {
  constructor(pool, config) { this.pool = pool; this.config = config; }

  platform(principal) {
    if (!principal.emailVerified || principal.realm !== this.config.realm
        || !this.config.platformAdminSubjects?.has(principal.subject)
        || !principal.permissions?.includes('platform:manage'))
      throw new ApiError(403, 'permission_denied', 'Verified platform administrator required.');
  }

  async organisation(principal, id) {
    if (!uuid.test(id)) throw new ApiError(400, 'organisation_invalid', 'Invalid organisation.');
    const { rows } = await this.pool.query(`SELECT o.id,o.status,o.openremote_realm AS realm,m.role
      FROM organisations o JOIN organisation_memberships m ON m.organisation_id=o.id AND m.subject=$2
      WHERE o.id=$1 AND o.openremote_realm=$3`, [id, principal.subject, principal.realm]);
    if (!principal.emailVerified || rows[0]?.status !== 'active' || rows[0]?.role !== 'administrator')
      throw new ApiError(403, 'permission_denied', 'Active organisation administrator required.');
    return rows[0];
  }

  async catalog(principal) {
    this.platform(principal);
    const { rows } = await this.pool.query('SELECT code,description,prerequisites FROM service_catalog ORDER BY code');
    return rows;
  }

  async platformOrganisation(principal, id) {
    this.platform(principal);
    if (!uuid.test(id)) throw new ApiError(400, 'organisation_invalid', 'Invalid organisation.');
    const { rows } = await this.pool.query(`SELECT id,status FROM organisations WHERE id=$1`, [id]);
    if (rows[0]?.status !== 'active') throw new ApiError(403, 'organisation_not_active', 'Only an active organisation can receive services.');
  }

  async listOrganisation(principal, id, platform = false) {
    if (platform) await this.platformOrganisation(principal, id);
    else await this.organisation(principal, id);
    const { rows } = await this.pool.query(`SELECT c.code,c.description,c.prerequisites,
      (g.organisation_id IS NOT NULL) AS enabled
      FROM service_catalog c LEFT JOIN organisation_services g
      ON g.service_code=c.code AND g.organisation_id=$1
      WHERE ($2::boolean OR g.organisation_id IS NOT NULL) ORDER BY c.code`, [id,platform]);
    return rows;
  }

  async setOrganisation(principal, id, code, enabled) {
    this.platform(principal);
    if (!uuid.test(id)) throw new ApiError(400, 'organisation_invalid', 'Invalid organisation.');
    if (!serviceCode.test(code) || typeof enabled !== 'boolean')
      throw new ApiError(400, 'service_invalid', 'Service code and enabled boolean are required.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const organisation = await db.query('SELECT status FROM organisations WHERE id=$1 FOR UPDATE', [id]);
      if (organisation.rows[0]?.status !== 'active')
        throw new ApiError(403, 'organisation_not_active', 'Only an active organisation can receive services.');
      const found = await db.query('SELECT 1 FROM service_catalog WHERE code=$1', [code]);
      if (!found.rows.length) throw new ApiError(404, 'service_not_found', 'Unknown service.');
      if (enabled) await db.query(`INSERT INTO organisation_services(organisation_id,service_code,granted_by)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [id,code,principal.subject]);
      else await db.query('DELETE FROM organisation_services WHERE organisation_id=$1 AND service_code=$2', [id,code]);
      // Revocation cascades to every user grant; re-enabling never restores old access.
      await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
        VALUES($1,$2,'service',$3,'success',$4)`, [principal.subject,enabled?'service.organisation.enabled':'service.organisation.disabled',`${id}:${code}`,randomUUID()]);
      await db.query('COMMIT');
      return { code, enabled };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async listOrganisationMarketZones(principal, id, collected) {
    await this.platformOrganisation(principal, id);
    const { rows } = await this.pool.query(`SELECT country,zone FROM organisation_market_zones
      WHERE organisation_id=$1 AND service_code='day_ahead'`, [id]);
    return MARKET_ZONES.map(item => ({ ...item,
      collected: collected.some(zone => zone.zone === item.zone && zone.enabled),
      enabled: rows.some(row => row.zone === item.zone && row.country === item.country) }));
  }

  async setOrganisationMarketZone(principal, id, country, zone, enabled) {
    await this.platformOrganisation(principal, id);
    const selected = MARKET_ZONES.find(item => item.country === country && item.zone === zone);
    if (!selected || typeof enabled !== 'boolean')
      throw new ApiError(400, 'market_zone_invalid', 'Select a supported country and bidding zone.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const service = await db.query(`SELECT 1 FROM organisation_services
        WHERE organisation_id=$1 AND service_code='day_ahead' FOR UPDATE`, [id]);
      if (enabled && !service.rows.length)
        throw new ApiError(403, 'service_not_enabled', 'Enable day-ahead for this organisation first.');
      if (enabled) await db.query(`INSERT INTO organisation_market_zones
        (organisation_id,country,zone,granted_by) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [id,country,zone,principal.subject]);
      else await db.query(`DELETE FROM organisation_market_zones WHERE organisation_id=$1 AND zone=$2`, [id,zone]);
      await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
        VALUES($1,$2,'market_zone',$3,'success',$4)`,
        [principal.subject,enabled?'market.zone.granted':'market.zone.revoked',`${id}:${zone}`,randomUUID()]);
      await db.query('COMMIT');
      return { country,zone,enabled };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async listMembers(principal, id, code) {
    await this.organisation(principal, id);
    const { rows } = await this.pool.query(`SELECT m.subject,m.role,
      (g.subject IS NOT NULL) AS enabled,i.email
      FROM organisation_memberships m
      LEFT JOIN member_services g ON g.organisation_id=m.organisation_id
        AND g.subject=m.subject AND g.service_code=$2
      LEFT JOIN LATERAL (SELECT email FROM organisation_invitations i
        WHERE i.organisation_id=m.organisation_id AND i.subject=m.subject AND i.state='accepted'
        ORDER BY i.created_at DESC LIMIT 1) i ON true
      WHERE m.organisation_id=$1 ORDER BY i.email NULLS LAST,m.subject`, [id,code]);
    return rows;
  }

  async setMember(principal, id, code, subject, enabled) {
    await this.organisation(principal, id);
    if (!serviceCode.test(code) || !subject || subject.length > 256 || typeof enabled !== 'boolean')
      throw new ApiError(400, 'service_invalid', 'Valid service, subject and enabled boolean are required.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const orgGrant = await db.query(`SELECT 1 FROM organisation_services g
        JOIN organisations o ON o.id=g.organisation_id AND o.status='active'
        WHERE g.organisation_id=$1 AND g.service_code=$2 FOR UPDATE OF g`, [id,code]);
      if (!orgGrant.rows.length) throw new ApiError(403, 'service_not_enabled', 'The organisation has not been granted this service.');
      if (enabled) {
        const member = await db.query(`SELECT 1 FROM organisation_memberships
          WHERE organisation_id=$1 AND subject=$2`, [id,subject]);
        if (!member.rows.length) throw new ApiError(404, 'member_not_found', 'Approved member not found.');
        await db.query(`INSERT INTO member_services(organisation_id,service_code,subject,granted_by)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`, [id,code,subject,principal.subject]);
      } else await db.query(`DELETE FROM member_services
        WHERE organisation_id=$1 AND service_code=$2 AND subject=$3`, [id,code,subject]);
      await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
        VALUES($1,$2,'service',$3,'success',$4)`, [principal.subject,enabled?'service.member.enabled':'service.member.disabled',`${id}:${code}:${subject}`,randomUUID()]);
      await db.query('COMMIT');
      return { code, subject, enabled };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async mine(principal) {
    if (!principal.emailVerified) return [];
    const { rows } = await this.pool.query(`SELECT g.service_code AS code FROM member_services g
      JOIN organisation_services og ON og.organisation_id=g.organisation_id AND og.service_code=g.service_code
      JOIN organisation_memberships m ON m.organisation_id=g.organisation_id AND m.subject=g.subject
      JOIN organisations o ON o.id=g.organisation_id AND o.status='active'
      WHERE g.subject=$1 AND o.openremote_realm=$2 ORDER BY g.service_code`, [principal.subject,principal.realm]);
    return rows;
  }
}
