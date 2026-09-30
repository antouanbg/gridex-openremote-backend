import pg from 'pg';
import { ApiError } from './errors.mjs';
import { MARKET_ZONES } from './market-prices.mjs';

export function hourlyPrices(intervals) {
  const groups = new Map();
  for (const item of intervals) {
    const start = Date.parse(item.startUtc);
    const end = Date.parse(item.endUtc);
    const duration = (end - start) / 60000;
    if (!Number.isFinite(start) || duration !== item.resolutionMinutes || ![15,60].includes(duration))
      throw new ApiError(502, 'market_invalid_interval', 'Invalid market interval.');
    const hour = Math.floor(start / 3600000) * 3600000;
    const values = groups.get(hour) || [];
    values.push({ start, end, price: item.priceEurMwh, duration });
    groups.set(hour, values);
  }
  const output = [];
  for (const [hour, values] of groups) {
    values.sort((a,b) => a.start-b.start);
    if (values[0].start !== hour || values.at(-1).end !== hour + 3600000
        || values.reduce((sum, value) => sum + value.duration, 0) !== 60
        || values.some((value, i) => i > 0 && value.start !== values[i-1].end)
        || new Set(values.map(value => value.duration)).size !== 1)
      continue; // Never persist a partial or mixed-resolution hour as an actual price.
    output.push({ startUtc: new Date(hour).toISOString(),
      priceEurMwh: values.reduce((sum, value) => sum + value.price * value.duration, 0) / 60,
      sourceResolutionMinutes: values[0].duration, sourceIntervalCount: values.length });
  }
  return output.sort((a,b) => a.startUtc.localeCompare(b.startUtc));
}

export class MarketStorage {
  constructor(database, { pool = null } = {}) {
    this.pool = pool || new pg.Pool({ ...database, max: 4, idleTimeoutMillis: 30000 });
  }
  async close() { await this.pool.end(); }
  async collectionZones() {
    const { rows } = await this.pool.query('SELECT zone,country,enabled,changed_at AS "changedAt" FROM market_collection_zones ORDER BY zone');
    return MARKET_ZONES.map(item => ({ ...item, enabled: rows.find(row => row.zone === item.zone)?.enabled === true }));
  }
  async enabledZones() {
    return (await this.collectionZones()).filter(zone => zone.enabled);
  }
  async isZoneEnabled(country, zone) {
    const { rows } = await this.pool.query('SELECT enabled FROM market_collection_zones WHERE country=$1 AND zone=$2', [country,zone]);
    return rows[0]?.enabled === true;
  }
  async setCollectionZone(country, zone, enabled, subject) {
    const selected = MARKET_ZONES.find(item => item.country === country && item.zone === zone);
    if (!selected || typeof enabled !== 'boolean')
      throw new ApiError(400, 'market_zone_invalid', 'Select a supported country and bidding zone.');
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const { rows } = await db.query(`INSERT INTO market_collection_zones(zone,country,enabled,changed_by)
        VALUES($1,$2,$3,$4) ON CONFLICT(zone) DO UPDATE SET enabled=excluded.enabled,
        changed_by=excluded.changed_by,changed_at=now() RETURNING zone,country,enabled`,
        [zone,country,enabled,subject]);
      await db.query(`INSERT INTO market_collection_zone_events(zone,country,enabled,changed_by)
        VALUES($1,$2,$3,$4)`, [zone,country,enabled,subject]);
      await db.query('COMMIT');
      return rows[0];
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
  async status() {
    const { rows } = await this.pool.query(`SELECT zone,s.country,status,error_code AS "errorCode",
      last_attempt_at AS "lastAttemptAt",last_success_at AS "lastSuccessAt",
      latest_delivery_date AS "latestDeliveryDate" FROM market_fetch_status s
      JOIN market_collection_zones c USING(zone) WHERE c.enabled=true ORDER BY zone`);
    return rows;
  }
  async prices({ country, zone, date, service }) {
    if (service !== 'day_ahead' || !/^[A-Z]{2}$/.test(country || '')
        || !/^[A-Za-z-]{2,32}$/.test(zone || '') || !/^\d{4}-\d{2}-\d{2}$/.test(date || ''))
      throw new ApiError(400, 'market_query_invalid', 'Valid day-ahead country, zone and date are required.');
    if (!(await this.isZoneEnabled(country, zone)))
      throw new ApiError(403, 'market_zone_disabled', 'Collection is not enabled for this zone.');
    const { rows } = await this.pool.query(`SELECT start_utc AS "startUtc",
      start_utc + interval '1 hour' AS "endUtc",price_eur_mwh::float8 AS "priceEurMwh",
      source_resolution_minutes AS "sourceResolutionMinutes",source_interval_count AS "sourceIntervalCount",
      source_document_id AS "sourceDocumentId",fetched_at AS "fetchedAt"
      FROM market_hourly_prices WHERE country=$1 AND zone=$2 AND delivery_date=$3
      ORDER BY start_utc`, [country,zone,date]);
    return { service,country,zone,date,currency:'EUR',unit:'MWh',aggregation:'hourly_mean',intervals:rows };
  }
  async save(result) {
    const hours = result.status === 'published' ? hourlyPrices(result.intervals) : [];
    const sourceIntervals = result.status === 'published' ? result.intervals : [];
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      // Lock the allowlist row for this transaction. A concurrent disable
      // waits for the current save; no prices can be saved after it commits.
      const permission = await db.query('SELECT enabled FROM market_collection_zones WHERE zone=$1 FOR SHARE', [result.zone]);
      if (permission.rows[0]?.enabled !== true) { await db.query('ROLLBACK'); return 0; }
      for (const interval of sourceIntervals) {
        const start = Date.parse(interval.startUtc);
        const end = Date.parse(interval.endUtc);
        if (!Number.isFinite(start) || !Number.isFinite(end)
            || ![15, 60].includes(interval.resolutionMinutes)
            || end - start !== interval.resolutionMinutes * 60000
            || !Number.isFinite(interval.priceEurMwh))
          throw new ApiError(502, 'market_invalid_interval', 'Invalid source market interval.');
        const price = Number(interval.priceEurMwh.toFixed(6));
        const values = [interval.startUtc,result.zone,result.country,result.date,price,
          result.sourceDocumentId || '',interval.resolutionMinutes,result.fetchedAt];
        await db.query(`INSERT INTO market_interval_price_revisions
          (start_utc,zone,country,delivery_date,price_eur_mwh,source_document_id,
           resolution_minutes,first_seen_at)
          SELECT $1,$2,$3,$4,$5,$6,$7,$8
          WHERE NOT EXISTS (SELECT 1 FROM market_interval_price_revisions
            WHERE zone=$2 AND start_utc=$1 AND price_eur_mwh=$5)
          ON CONFLICT DO NOTHING`, values);
        await db.query(`INSERT INTO market_interval_prices
          (start_utc,zone,country,delivery_date,price_eur_mwh,source_document_id,
           resolution_minutes,fetched_at)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT (zone,start_utc) DO UPDATE SET price_eur_mwh=excluded.price_eur_mwh,
            source_document_id=excluded.source_document_id,
            resolution_minutes=excluded.resolution_minutes,fetched_at=excluded.fetched_at`,
        values);
      }
      for (const hour of hours) {
        // Match the numeric(16,6) archive precision before deduplication.
        const price=Number(hour.priceEurMwh.toFixed(6));
        const values=[hour.startUtc,result.zone,result.country,result.date,price,result.sourceDocumentId||'',
          hour.sourceResolutionMinutes,hour.sourceIntervalCount,result.fetchedAt];
        await db.query(`INSERT INTO market_hourly_price_revisions
        (start_utc,zone,country,delivery_date,price_eur_mwh,source_document_id,
         source_resolution_minutes,source_interval_count,first_seen_at)
        SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9
        WHERE NOT EXISTS (SELECT 1 FROM market_hourly_price_revisions
          WHERE zone=$2 AND start_utc=$1 AND price_eur_mwh=$5)
        ON CONFLICT DO NOTHING`, values);
        await db.query(`INSERT INTO market_hourly_prices
        (start_utc,zone,country,delivery_date,price_eur_mwh,source_document_id,
         source_resolution_minutes,source_interval_count,fetched_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (zone,start_utc) DO UPDATE SET price_eur_mwh=excluded.price_eur_mwh,
          source_document_id=excluded.source_document_id,
          source_resolution_minutes=excluded.source_resolution_minutes,
          source_interval_count=excluded.source_interval_count,fetched_at=excluded.fetched_at`,
        values);
      }
      await db.query(`INSERT INTO market_fetch_status(zone,country,last_attempt_at,last_success_at,latest_delivery_date,status,error_code)
        VALUES($1,$2,$3,$4,$5,$6,NULL)
        ON CONFLICT(zone) DO UPDATE SET country=excluded.country,last_attempt_at=excluded.last_attempt_at,
          last_success_at=COALESCE(excluded.last_success_at,market_fetch_status.last_success_at),
          latest_delivery_date=CASE WHEN excluded.status='published' THEN excluded.latest_delivery_date ELSE market_fetch_status.latest_delivery_date END,
          status=excluded.status,error_code=NULL`,
        [result.zone,result.country,result.fetchedAt,result.status==='published'?result.fetchedAt:null,
          result.status==='published'?result.date:null,result.status]);
      await db.query('COMMIT');
      return hours.length;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
  async recordError(zone, country, code) {
    await this.pool.query(`INSERT INTO market_fetch_status(zone,country,last_attempt_at,status,error_code)
      VALUES($1,$2,now(),'error',$3) ON CONFLICT(zone) DO UPDATE SET
      last_attempt_at=excluded.last_attempt_at,status='error',error_code=excluded.error_code`,
    [zone,country,String(code || 'market_upstream_unavailable').slice(0,100)]);
  }
}
