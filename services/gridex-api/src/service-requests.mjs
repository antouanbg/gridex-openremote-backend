import { randomUUID } from 'node:crypto';
import { ApiError } from './errors.mjs';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const codes = new Set(['day_ahead', 'visualisations']);

export class ServiceRequests {
  constructor(pool, entitlements, market, notifications = null) {
    this.pool = pool;
    this.entitlements = entitlements;
    this.market = market;
    this.notifications = notifications;
  }

  async membership(principal, organisationId) {
    if (!principal.emailVerified || !uuid.test(organisationId))
      throw new ApiError(403, 'permission_denied', 'Verified organisation membership required.');
    const { rows } = await this.pool.query(`SELECT 1 FROM organisations o
      JOIN organisation_memberships m ON m.organisation_id=o.id AND m.subject=$2
      WHERE o.id=$1 AND o.openremote_realm=$3 AND o.status='active'`,
    [organisationId, principal.subject, principal.realm]);
    if (!rows.length) throw new ApiError(403, 'permission_denied', 'Active organisation membership required.');
  }

  async catalog(principal) {
    if (!principal.emailVerified) throw new ApiError(403, 'permission_denied', 'Verified account required.');
    const { rows: member } = await this.pool.query(`SELECT 1 FROM organisation_memberships m
      JOIN organisations o ON o.id=m.organisation_id AND o.status='active'
      WHERE m.subject=$1 AND o.openremote_realm=$2 LIMIT 1`, [principal.subject,principal.realm]);
    if (!member.length) throw new ApiError(403, 'permission_denied', 'Active organisation membership required.');
    const { rows } = await this.pool.query(`SELECT code,description,requestable FROM service_catalog ORDER BY code`);
    return rows;
  }

  async createOrganisation(principal, organisationId, input) {
    await this.entitlements.organisation(principal, organisationId);
    return this.create(principal, { ...input, organisationId }, 'organisation');
  }

  async create(principal, input, requestScope = 'member') {
    const organisationId = input?.organisationId;
    const code = input?.serviceCode;
    await this.membership(principal, organisationId);
    if (!codes.has(code) || (code === 'day_ahead' && (input.country !== 'BG' || input.zone !== 'BG'))
        || (code !== 'day_ahead' && (input.country != null || input.zone != null)))
      throw new ApiError(400, 'service_request_invalid', 'Choose an available service and one supported country.');
    const { rows: catalog } = await this.pool.query('SELECT requestable FROM service_catalog WHERE code=$1', [code]);
    if (!catalog[0]?.requestable) throw new ApiError(403, 'service_unavailable', 'This service cannot be requested yet.');
    const { rows: granted } = requestScope === 'organisation'
      ? await this.pool.query(`SELECT 1 FROM organisation_services WHERE organisation_id=$1 AND service_code=$2
          AND ($2<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones
            WHERE organisation_id=$1 AND country='BG' AND zone='BG'))`, [organisationId, code])
      : await this.pool.query(`SELECT 1 FROM member_services WHERE organisation_id=$1
        AND subject=$2 AND service_code=$3`, [organisationId, principal.subject, code]);
    if (granted.length) throw new ApiError(409, 'service_already_enabled', 'This service is already enabled.');
    const email = String(principal.email || '').trim().toLowerCase();
    if (!email || email.length > 320) throw new ApiError(403, 'verified_email_required', 'A verified email is required.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const id = randomUUID();
      const { rows } = await db.query(`INSERT INTO service_requests
        (id,organisation_id,subject,realm,email,service_code,country,zone,request_scope)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT DO NOTHING RETURNING id`,
      [id, organisationId, principal.subject, principal.realm, email, code,
        code === 'day_ahead' ? 'BG' : null, code === 'day_ahead' ? 'BG' : null, requestScope]);
      const requestId = rows[0]?.id || (await db.query(`SELECT id FROM service_requests
        WHERE organisation_id=$1 AND (request_scope='organisation' OR subject=$2)
          AND service_code=$3 AND state='open' AND request_scope=$4`,
      [organisationId, principal.subject, code, requestScope])).rows[0]?.id;
      if (!requestId) throw new ApiError(409, 'service_request_conflict', 'Request could not be created.');
      if (rows.length) await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action)
        VALUES($1,$2,$3,'requested')`, [randomUUID(), requestId, principal.subject]);
      if (rows.length && this.notifications) await this.notifications.enqueue(db, { eventKey:`${requestId}:requested`,
        organisationId, serviceCode:code, kind:requestScope==='organisation'?'organisation_requested':'member_requested' });
      await db.query('COMMIT');
      return { id: requestId, created: rows.length > 0 };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async list(principal, scope, organisationId = null) {
    if (scope === 'platform') this.entitlements.platform(principal);
    else if (scope === 'organisation') await this.entitlements.organisation(principal, organisationId);
    else if (!principal.emailVerified) throw new ApiError(403, 'permission_denied', 'Verified account required.');
    const where = scope === 'platform' ? 'TRUE' : scope === 'organisation'
      ? 'r.organisation_id=$1' : `r.subject=$1 AND r.realm=$2 AND r.request_scope='member' AND EXISTS
        (SELECT 1 FROM organisation_memberships own JOIN organisations oo ON oo.id=own.organisation_id
         WHERE own.organisation_id=r.organisation_id AND own.subject=r.subject
           AND oo.openremote_realm=r.realm AND oo.status='active')`;
    const params = scope === 'platform' ? [] : scope === 'organisation'
      ? [organisationId] : [principal.subject, principal.realm];
    const { rows } = await this.pool.query(`SELECT r.id,r.organisation_id AS "organisationId",
      o.name AS "organisationName",r.subject,r.email,r.service_code AS "serviceCode",
      r.country,r.zone,r.state,r.request_scope AS "requestScope",r.created_at AS "createdAt",
      CASE WHEN r.state='cancelled' THEN 'cancelled'
        WHEN r.state='rejected' THEN 'rejected'
        WHEN r.request_scope='organisation' AND os.organisation_id IS NOT NULL
          AND (r.service_code<>'day_ahead' OR oz.organisation_id IS NOT NULL) THEN 'organisation_enabled'
        WHEN ms.subject IS NOT NULL AND os.organisation_id IS NOT NULL
          AND (r.service_code<>'day_ahead' OR oz.organisation_id IS NOT NULL) THEN 'active'
        WHEN r.state='approved' THEN 'revoked'
        WHEN os.organisation_id IS NOT NULL
          AND (r.service_code<>'day_ahead' OR oz.organisation_id IS NOT NULL) THEN 'awaiting_organisation'
        ELSE 'awaiting_platform' END AS stage,
      COALESCE(ev.events,'[]'::json) AS events
      FROM service_requests r JOIN organisations o ON o.id=r.organisation_id
      LEFT JOIN organisation_services os ON os.organisation_id=r.organisation_id AND os.service_code=r.service_code
      LEFT JOIN member_services ms ON ms.organisation_id=r.organisation_id AND ms.service_code=r.service_code AND ms.subject=r.subject
      LEFT JOIN organisation_market_zones oz ON oz.organisation_id=r.organisation_id AND oz.service_code='day_ahead' AND oz.country=r.country AND oz.zone=r.zone
      LEFT JOIN LATERAL (SELECT json_agg(json_build_object('action',e.action,'at',e.created_at,'note',e.note)
        ORDER BY e.created_at) AS events FROM service_request_events e WHERE e.request_id=r.id) ev ON true
      WHERE ${where} ORDER BY r.created_at DESC LIMIT 200`, params);
    return rows;
  }

  async approvePlatform(principal, requestId) {
    this.entitlements.platform(principal);
    if (!uuid.test(requestId)) throw new ApiError(400, 'service_request_invalid', 'Invalid request.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(`SELECT r.*,o.status FROM service_requests r
        JOIN organisations o ON o.id=r.organisation_id AND o.openremote_realm=r.realm
        JOIN organisation_memberships m ON m.organisation_id=r.organisation_id AND m.subject=r.subject AND m.role='administrator'
        WHERE r.id=$1 FOR UPDATE OF r`, [requestId]);
      const request = rows[0];
      if (!request || request.state !== 'open' || request.status !== 'active')
        throw new ApiError(409, 'service_request_unavailable', 'Only an open request for an active organisation can be approved.');
      if (request.request_scope !== 'organisation')
        throw new ApiError(403, 'organisation_request_required', 'The organisation administrator must request the organisation service.');
      if (request.service_code === 'day_ahead' && (!this.market ||
        !(await this.market.collectionZones()).some(zone => zone.country === 'BG' && zone.zone === 'BG' && zone.enabled)))
        throw new ApiError(403, 'market_zone_disabled', 'BG collection must be enabled first.');
      await db.query(`INSERT INTO organisation_services(organisation_id,service_code,granted_by)
        VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, [request.organisation_id, request.service_code, principal.subject]);
      if (request.service_code === 'day_ahead') await db.query(`INSERT INTO organisation_market_zones
        (organisation_id,country,zone,granted_by) VALUES($1,'BG','BG',$2) ON CONFLICT DO NOTHING`,
      [request.organisation_id,principal.subject]);
      const previous = await db.query(`SELECT 1 FROM service_request_events
        WHERE request_id=$1 AND action='platform_approved'`, [requestId]);
      if (!previous.rows.length) await db.query(`INSERT INTO service_request_events
        (id,request_id,actor_subject,action) VALUES($1,$2,$3,'platform_approved')`,
      [randomUUID(),requestId,principal.subject]);
      await db.query(`UPDATE service_requests SET state='approved',updated_at=now() WHERE id=$1`, [requestId]);
      if (!previous.rows.length && this.notifications) await this.notifications.enqueue(db,
        { eventKey:`${requestId}:platform_approved`, organisationId:request.organisation_id,
          serviceCode:request.service_code, kind:'organisation_granted' });
      await db.query('COMMIT');
      return { id: requestId, stage: request.request_scope==='organisation'?'organisation_enabled':'awaiting_organisation' };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async approveOrganisation(principal, organisationId, requestId) {
    await this.entitlements.organisation(principal, organisationId);
    if (!uuid.test(requestId)) throw new ApiError(400, 'service_request_invalid', 'Invalid request.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(`SELECT r.* FROM service_requests r WHERE r.id=$1
        AND r.organisation_id=$2 AND r.state='open' FOR UPDATE`, [requestId,organisationId]);
      const request = rows[0];
      if (!request) throw new ApiError(404, 'service_request_not_found', 'Request not found in this organisation.');
      if (request.request_scope === 'organisation')
        throw new ApiError(403, 'platform_approval_required', 'Only the platform administrator approves organisation requests.');
      const { rows: ready } = await db.query(`SELECT 1 FROM organisation_services os
        JOIN organisations o ON o.id=os.organisation_id AND o.status='active' AND o.openremote_realm=$4
        JOIN organisation_memberships m ON m.organisation_id=os.organisation_id AND m.subject=$3
        WHERE os.organisation_id=$1 AND os.service_code=$2 AND
          ($2<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones z
            WHERE z.organisation_id=$1 AND z.service_code='day_ahead' AND z.country='BG' AND z.zone='BG'))`,
      [organisationId,request.service_code,request.subject,request.realm]);
      if (!ready.length) throw new ApiError(403, 'service_not_enabled', 'Platform grant and active member are required.');
      await db.query(`INSERT INTO member_services(organisation_id,service_code,subject,granted_by)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
      [organisationId,request.service_code,request.subject,principal.subject]);
      const previous = await db.query(`SELECT 1 FROM service_request_events
        WHERE request_id=$1 AND action='organisation_approved'`, [requestId]);
      if (!previous.rows.length) await db.query(`INSERT INTO service_request_events
        (id,request_id,actor_subject,action) VALUES($1,$2,$3,'organisation_approved')`,
      [randomUUID(),requestId,principal.subject]);
      await db.query(`UPDATE service_requests SET state='approved',updated_at=now() WHERE id=$1`, [requestId]);
      if (!previous.rows.length && this.notifications) await this.notifications.enqueue(db,
        { eventKey:`${requestId}:organisation_approved`, organisationId, serviceCode:request.service_code,
          kind:'member_granted', subject:request.subject, realm:request.realm });
      await db.query('COMMIT');
      return { id: requestId, stage: 'active' };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async reject(principal, requestId, organisationId = null, note = '') {
    if (!uuid.test(requestId) || typeof note !== 'string' || note.length > 500)
      throw new ApiError(400, 'service_request_invalid', 'Invalid request or note.');
    if (organisationId) await this.entitlements.organisation(principal, organisationId);
    else this.entitlements.platform(principal);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(`SELECT r.* FROM service_requests r WHERE r.id=$1
        ${organisationId ? 'AND r.organisation_id=$2' : ''} FOR UPDATE`,
      organisationId ? [requestId,organisationId] : [requestId]);
      const request = rows[0];
      if (!request || request.state !== 'open') throw new ApiError(409, 'service_request_unavailable', 'Request is not open.');
      if ((organisationId && request.request_scope === 'organisation') || (!organisationId && request.request_scope !== 'organisation'))
        throw new ApiError(403, 'request_scope_denied', 'This request is decided by the other administration level.');
      const active = await db.query(`SELECT 1 FROM member_services WHERE organisation_id=$1
        AND service_code=$2 AND subject=$3`, [request.organisation_id,request.service_code,request.subject]);
      if (active.rows.length) throw new ApiError(409, 'service_already_enabled', 'Revoke the active service separately.');
      await db.query(`UPDATE service_requests SET state='rejected',updated_at=now() WHERE id=$1`, [requestId]);
      await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action,note)
        VALUES($1,$2,$3,'rejected',$4)`, [randomUUID(),requestId,principal.subject,note.trim()||null]);
      if (this.notifications) await this.notifications.enqueue(db, { eventKey:`${requestId}:rejected`,
        organisationId:request.organisation_id, serviceCode:request.service_code, kind:'request_rejected',
        subject:request.subject, realm:request.realm });
      await db.query('COMMIT');
      return { id: requestId, stage: 'rejected' };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async cancelOrganisation(principal, organisationId, requestId) {
    await this.entitlements.organisation(principal, organisationId);
    if (!uuid.test(requestId)) throw new ApiError(400, 'service_request_invalid', 'Invalid request.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(`SELECT r.* FROM service_requests r WHERE r.id=$1
        AND r.organisation_id=$2 AND r.subject=$3 AND r.realm=$4 AND r.request_scope='organisation'
        AND r.state='open' FOR UPDATE`, [requestId, organisationId, principal.subject, principal.realm]);
      const request = rows[0];
      if (!request) throw new ApiError(409, 'service_request_unavailable', 'Only your pending organisation request can be cancelled.');
      const granted = await db.query(`SELECT 1 FROM organisation_services WHERE organisation_id=$1 AND service_code=$2
        AND ($2<>'day_ahead' OR EXISTS (SELECT 1 FROM organisation_market_zones
          WHERE organisation_id=$1 AND country='BG' AND zone='BG'))`,
        [organisationId, request.service_code]);
      if (granted.rows.length) throw new ApiError(409, 'service_already_enabled', 'An approved service must be revoked separately.');
      await db.query(`UPDATE service_requests SET state='cancelled',updated_at=now() WHERE id=$1`, [requestId]);
      await db.query(`INSERT INTO service_request_events(id,request_id,actor_subject,action)
        VALUES($1,$2,$3,'cancelled')`, [randomUUID(), requestId, principal.subject]);
      if (this.notifications) await this.notifications.enqueue(db, { eventKey:`${requestId}:cancelled`,
        organisationId, serviceCode:request.service_code, kind:'organisation_cancelled' });
      await db.query('COMMIT');
      return { id:requestId, stage:'cancelled' };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
}
