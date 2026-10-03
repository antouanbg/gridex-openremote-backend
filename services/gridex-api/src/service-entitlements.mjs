import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';
import { MARKET_ZONES } from './market-prices.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const serviceCode = /^[a-z][a-z0-9_]{1,63}$/;

export class ServiceEntitlements {
  constructor(pool, config, notifications = null) { this.pool = pool; this.config = config; this.notifications = notifications; }

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
    const { rows } = await this.pool.query('SELECT code,description,prerequisites,requestable FROM service_catalog ORDER BY code');
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
    const { rows } = await this.pool.query(`SELECT c.code,c.description,c.prerequisites,c.requestable,
      (g.organisation_id IS NOT NULL) AS enabled,g.granted_at AS "grantedAt",
      COALESCE((SELECT json_agg(json_build_object('country',z.country,'zone',z.zone))
        FROM organisation_market_zones z WHERE z.organisation_id=$1 AND z.service_code=c.code),'[]'::json) AS zones
      FROM service_catalog c LEFT JOIN organisation_services g
      ON g.service_code=c.code AND g.organisation_id=$1
      ORDER BY c.code`, [id]);
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
      const found = await db.query('SELECT requestable FROM service_catalog WHERE code=$1', [code]);
      if (!found.rows.length) throw new ApiError(404, 'service_not_found', 'Unknown service.');
      if (enabled && !found.rows[0].requestable) throw new ApiError(403, 'service_unavailable', 'This service is not available yet.');
      const revokedMembers = !enabled && this.notifications ? (await db.query(`SELECT m.subject,o.openremote_realm AS realm
        FROM member_services m JOIN organisations o ON o.id=m.organisation_id
        WHERE m.organisation_id=$1 AND m.service_code=$2`, [id,code])).rows : [];
      const changed = enabled ? await db.query(`INSERT INTO organisation_services(organisation_id,service_code,granted_by)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING organisation_id`, [id,code,principal.subject])
        : await db.query('DELETE FROM organisation_services WHERE organisation_id=$1 AND service_code=$2 RETURNING organisation_id', [id,code]);
      if (changed.rows.length && this.notifications) {
        const eventKey = randomUUID();
        await this.notifications.enqueue(db, { eventKey, organisationId:id, serviceCode:code,
          kind:enabled?'organisation_granted':'organisation_revoked' });
        for (const member of revokedMembers) await this.notifications.enqueue(db, { eventKey,
          organisationId:id, serviceCode:code, kind:'member_revoked', ...member });
      }
      if (enabled) await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action)
        SELECT gen_random_uuid(),r.id,$3,'platform_approved' FROM service_requests r
        WHERE r.organisation_id=$1 AND r.service_code=$2 AND r.state='open'
          AND (r.service_code<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones z
            WHERE z.organisation_id=$1 AND z.service_code='day_ahead' AND z.country='BG' AND z.zone='BG'))
        ON CONFLICT DO NOTHING`, [id,code,principal.subject]);
      if (enabled) await db.query(`UPDATE service_requests SET state='approved',updated_at=now()
        WHERE organisation_id=$1 AND service_code=$2 AND request_scope='organisation' AND state='open'
          AND ($2<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones z
            WHERE z.organisation_id=$1 AND z.service_code='day_ahead' AND z.country='BG' AND z.zone='BG'))`, [id,code]);
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
      if (enabled && country === 'BG' && zone === 'BG') await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action)
        SELECT gen_random_uuid(),r.id,$2,'platform_approved' FROM service_requests r
        JOIN organisation_services s ON s.organisation_id=r.organisation_id AND s.service_code='day_ahead'
        WHERE r.organisation_id=$1 AND r.service_code='day_ahead' AND r.state='open'
        ON CONFLICT DO NOTHING`, [id,principal.subject]);
      if (enabled && country === 'BG' && zone === 'BG') await db.query(`UPDATE service_requests
        SET state='approved',updated_at=now() WHERE organisation_id=$1 AND service_code='day_ahead'
          AND request_scope='organisation' AND state='open'`, [id]);
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
        JOIN service_catalog c ON c.code=g.service_code AND c.requestable=true
        JOIN organisations o ON o.id=g.organisation_id AND o.status='active'
        WHERE g.organisation_id=$1 AND g.service_code=$2
          AND ($2<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones z
            WHERE z.organisation_id=$1 AND z.service_code='day_ahead' AND z.country='BG' AND z.zone='BG'))
        FOR UPDATE OF g`, [id,code]);
      if (!orgGrant.rows.length) throw new ApiError(403, 'service_not_enabled', 'The organisation has not been granted this service.');
      let changed;
      if (enabled) {
        const member = await db.query(`SELECT 1 FROM organisation_memberships
          WHERE organisation_id=$1 AND subject=$2`, [id,subject]);
        if (!member.rows.length) throw new ApiError(404, 'member_not_found', 'Approved member not found.');
        changed = await db.query(`INSERT INTO member_services(organisation_id,service_code,subject,granted_by)
          VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING subject`, [id,code,subject,principal.subject]);
        await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action)
          SELECT gen_random_uuid(),r.id,$4,'organisation_approved' FROM service_requests r
          WHERE r.organisation_id=$1 AND r.service_code=$2 AND r.subject=$3 AND r.request_scope='member' AND r.state='open'
          ON CONFLICT DO NOTHING`, [id,code,subject,principal.subject]);
        await db.query(`UPDATE service_requests SET state='approved',updated_at=now()
          WHERE organisation_id=$1 AND service_code=$2 AND subject=$3 AND request_scope='member' AND state='open'`, [id,code,subject]);
      } else changed = await db.query(`DELETE FROM member_services
        WHERE organisation_id=$1 AND service_code=$2 AND subject=$3 RETURNING subject`, [id,code,subject]);
      if (changed.rows.length && this.notifications) await this.notifications.enqueue(db,
        { eventKey:randomUUID(), organisationId:id, serviceCode:code, subject, realm:principal.realm,
          kind:enabled?'member_granted':'member_revoked' });
      await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
        VALUES($1,$2,'service',$3,'success',$4)`, [principal.subject,enabled?'service.member.enabled':'service.member.disabled',`${id}:${code}:${subject}`,randomUUID()]);
      await db.query('COMMIT');
      return { code, subject, enabled };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async stopOwn(principal, id, code) {
    if (!principal.emailVerified) throw new ApiError(403, 'permission_denied', 'Verified member required.');
    if (!uuid.test(id) || !['day_ahead','visualisations'].includes(code))
      throw new ApiError(400, 'service_invalid', 'Valid organisation and service required.');
    // Platform access is not a personal grant and cannot be self-revoked here.
    if (principal.permissions?.includes('platform:manage'))
      throw new ApiError(403, 'permission_denied', 'Platform access is not a personal service grant.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const member = await db.query(`SELECT m.subject FROM organisation_memberships m
        JOIN organisations o ON o.id=m.organisation_id
        WHERE o.id=$1 AND m.subject=$2 AND o.openremote_realm=$3 AND o.status='active'
        FOR SHARE OF o,m`, [id, principal.subject, principal.realm]);
      if (!member.rows.length) throw new ApiError(403, 'permission_denied', 'Active membership required.');
      const changed = await db.query(`DELETE FROM member_services
        WHERE organisation_id=$1 AND service_code=$2 AND subject=$3 RETURNING subject`,
      [id, code, principal.subject]);
      if (changed.rows.length) {
        await db.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
          VALUES($1,'service.member.self_stopped','service',$2,'success',$3)`,
        [principal.subject, id+':'+code+':'+principal.subject, randomUUID()]);
        if (this.notifications) await this.notifications.enqueue(db, {
          eventKey:randomUUID(), organisationId:id, serviceCode:code, subject:principal.subject,
          realm:principal.realm, kind:'member_revoked' });
      }
      await db.query('COMMIT');
      return { code, enabled:false, changed:changed.rows.length>0 };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async mine(principal) {
    if (!principal.emailVerified) return [];
    const { rows } = await this.pool.query(`SELECT g.organisation_id AS "organisationId",g.service_code AS code FROM member_services g
      JOIN organisation_services og ON og.organisation_id=g.organisation_id AND og.service_code=g.service_code
      JOIN organisation_memberships m ON m.organisation_id=g.organisation_id AND m.subject=g.subject
      JOIN organisations o ON o.id=g.organisation_id AND o.status='active'
      WHERE g.subject=$1 AND o.openremote_realm=$2 ORDER BY g.service_code`, [principal.subject,principal.realm]);
    return rows;
  }

  async requireSiteVisualisations(principal, organisationId) {
    if (!principal.emailVerified || !uuid.test(organisationId))
      throw new ApiError(403, 'service_not_enabled', 'Verified service access required.');
    try { this.platform(principal); return; } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'permission_denied') throw error;
    }
    const { rows } = await this.pool.query(`SELECT 1 FROM organisations o
      JOIN organisation_memberships m ON m.organisation_id=o.id AND m.subject=$2
      JOIN organisation_services s ON s.organisation_id=o.id AND s.service_code='visualisations'
      JOIN member_services g ON g.organisation_id=o.id AND g.subject=$2 AND g.service_code='visualisations'
      WHERE o.id=$1 AND o.openremote_realm=$3 AND o.status='active' LIMIT 1`,
    [organisationId, principal.subject, principal.realm]);
    if (!rows.length) throw new ApiError(403, 'service_not_enabled', 'Visualisations are not enabled for this member.');
  }
}
