// Observation only. MQTT certificate ACLs bind publishers to exact topics.
export function parseHeartbeat(topic, buffer, binding, { retained = false, now = Date.now(), maxAgeMs = 120000 } = {}) {
  if (retained || buffer.length > 32768) throw new Error('retained_or_oversize');
  const data = JSON.parse(buffer.toString());
  if (data.schemaVersion !== 1 || typeof data.observedAt !== 'string') throw new Error('schema');
  const observed = Date.parse(data.observedAt);
  if (!Number.isFinite(observed) || observed > now + 5000 || now - observed > maxAgeMs) throw new Error('stale_or_future');
  const base = `${binding.prefix}/sites/${binding.site}/edge/${binding.gateway}`;
  if (topic === `${base}/health`) {
    if (data.gatewayId !== binding.gateway) throw new Error('identity');
    return { gatewayId: binding.gatewayId, sourceGatewayId: binding.gatewayId, siteId: binding.siteId,
      observedAt: new Date(observed).toISOString(), online: true, lastSuccessfulContactAt: null, heartbeat: null };
  }
  const slot = Object.keys(binding.nodes).find(key => topic === `${base}/nodes/${key}/telemetry`);
  if (!slot || data.slot !== Number(slot) || typeof data.online !== 'boolean') throw new Error('node_identity');
  if (!Number.isInteger(data.heartbeat) || data.heartbeat < 0 || data.heartbeat > 65535) throw new Error('heartbeat');
  const contact = data.lastSuccessfulContactAt == null ? null : Date.parse(data.lastSuccessfulContactAt);
  if (contact !== null && (!Number.isFinite(contact) || contact > observed)) throw new Error('contact_time');
  return { gatewayId: binding.nodes[slot], sourceGatewayId: binding.gatewayId, siteId: binding.siteId,
    observedAt: new Date(observed).toISOString(), online: data.online && data.pollStatus === 1,
    lastSuccessfulContactAt: contact === null ? null : new Date(contact).toISOString(), heartbeat: data.heartbeat };
}

export function heartbeatStatuses(rows, now = Date.now(), staleMs = 30000, offlineMs = 90000) {
  const freshness = time => time == null ? 'unknown' : now - Date.parse(time) > offlineMs ? 'offline'
    : now - Date.parse(time) > staleMs ? 'stale' : 'online';
  return rows.map(row => {
    const rock = row.gatewayId === row.sourceGatewayId;
    const source = rows.find(item => item.gatewayId === row.sourceGatewayId);
    const sourceStatus = source ? freshness(source.observedAt) : 'unknown';
    let status = rock ? freshness(row.observedAt) : freshness(row.lastSuccessfulContactAt);
    if (!rock && sourceStatus !== 'online') status = sourceStatus === 'unknown' ? 'unknown' : 'stale';
    else if (!rock && !row.online) status = 'offline';
    return { ...row, status, sourceStatus };
  });
}

export class DeviceHeartbeats {
  constructor(pool) { this.pool = pool; }
  async accept(message) {
    const m = message;
    // Both registered devices must belong to the same Site; never create inventory from MQTT.
    const result = await this.pool.query(`INSERT INTO device_heartbeats
      (gateway_id,site_id,source_gateway_id,observed_at,last_successful_contact_at,online,heartbeat)
      SELECT $1,$2,$3,$4,$5,$6,$7 WHERE EXISTS
        (SELECT 1 FROM gateways g JOIN gateways s ON s.id=$3 AND s.site_id=g.site_id
         WHERE g.id=$1 AND g.site_id=$2 AND s.role='controller')
      ON CONFLICT(gateway_id) DO UPDATE SET observed_at=EXCLUDED.observed_at,received_at=now(),
        last_successful_contact_at=GREATEST(device_heartbeats.last_successful_contact_at,EXCLUDED.last_successful_contact_at),
        online=EXCLUDED.online,heartbeat=EXCLUDED.heartbeat
      WHERE device_heartbeats.site_id=EXCLUDED.site_id
        AND device_heartbeats.source_gateway_id=EXCLUDED.source_gateway_id
        AND device_heartbeats.observed_at < EXCLUDED.observed_at`,
    [m.gatewayId,m.siteId,m.sourceGatewayId,m.observedAt,m.lastSuccessfulContactAt,m.online,m.heartbeat]);
    return result.rowCount === 1;
  }
  async list(siteId) {
    const { rows } = await this.pool.query(`SELECT gateway_id AS "gatewayId",source_gateway_id AS "sourceGatewayId",
      observed_at AS "observedAt",received_at AS "receivedAt",last_successful_contact_at AS "lastSuccessfulContactAt",
      online,heartbeat FROM device_heartbeats WHERE site_id=$1`, [siteId]);
    return rows;
  }
}
