import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { ApiError } from "./errors.mjs";

const { Pool } = pg;
const migrationUrl = new URL("../migrations/001_gridex_core.sql", import.meta.url);

const siteRow = (row) => ({
  id: row.id,
  organisationId: row.organisation_id,
  name: row.name,
  timezone: row.timezone,
  marketCode: row.market_code,
  status: row.status,
  openremoteRealm: row.openremote_realm,
  openremoteSiteAssetId: row.openremote_site_asset_id,
  openremoteStrategyAssetId: row.openremote_strategy_asset_id,
  openremoteControlAssetId: row.openremote_control_asset_id,
});

const deviceRow = (row) => ({
  id: row.id,
  siteId: row.site_id,
  parentDeviceId: row.parent_device_id,
  gatewayId: row.gateway_id,
  gatewayPortId: row.gateway_port_id,
  type: row.device_type,
  name: row.name,
  manufacturer: row.manufacturer,
  model: row.model,
  serialNumber: row.serial_number,
  driverKey: row.driver_key,
  protocol: row.protocol,
  connection: row.connection || {},
  status: row.status,
  openremoteAssetId: row.openremote_asset_id,
  revision: row.revision,
});

export class PostgresRepository {
  constructor(database) {
    this.pool = new Pool({ ...database, max: 10, idleTimeoutMillis: 30000 });
  }

  async migrate() {
    const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
    await this.pool.query(sql);
  }

  async close() { await this.pool.end(); }

  async listAccessibleSites(subject) {
    const { rows } = await this.pool.query(`
      SELECT DISTINCT s.*
      FROM sites s
      JOIN organisation_memberships m ON m.organisation_id = s.organisation_id
      WHERE m.subject = $1 AND s.deleted_at IS NULL
      ORDER BY s.name`, [subject]);
    return rows.map(siteRow);
  }

  async getUserPreferences(subject) {
    const { rows } = await this.pool.query("SELECT revision, preferences FROM user_preferences WHERE subject=$1", [subject]);
    return rows[0] ? { revision: rows[0].revision, ...rows[0].preferences } : {
      revision: 0, locale: "en", displayTimezone: "site", units: "metric", currency: "EUR", theme: "system",
      notifications: { channels: ["email"], minimumSeverity: "warning" },
    };
  }

  async updateUserPreferences(subject, preferences, expectedRevision) {
    const nextRevision = expectedRevision + 1;
    const payload = { ...preferences }; delete payload.revision;
    const { rows } = await this.pool.query(`
      INSERT INTO user_preferences(subject,revision,preferences) VALUES($1,$2,$3::jsonb)
      ON CONFLICT(subject) DO UPDATE SET revision=$2,preferences=$3::jsonb,updated_at=now()
      WHERE user_preferences.revision=$4 RETURNING revision,preferences`, [subject, nextRevision, JSON.stringify(payload), expectedRevision]);
    if (!rows[0]) throw new ApiError(412, "stale_revision", "The user preferences have changed.");
    return { revision: rows[0].revision, ...rows[0].preferences };
  }

  async requireSite(subject, siteId) {
    const { rows } = await this.pool.query(`
      SELECT s.*
      FROM sites s
      JOIN organisation_memberships m ON m.organisation_id = s.organisation_id
      WHERE s.id = $1 AND m.subject = $2 AND s.deleted_at IS NULL
      LIMIT 1`, [siteId, subject]);
    if (!rows[0]) throw new ApiError(404, "site_not_found", "The site was not found or is not accessible.");
    return siteRow(rows[0]);
  }

  async listDevices(siteId) {
    const { rows } = await this.pool.query("SELECT * FROM devices WHERE site_id = $1 AND deleted_at IS NULL ORDER BY created_at", [siteId]);
    return rows.map(deviceRow);
  }

  async getDevice(siteId, deviceId) {
    const { rows } = await this.pool.query("SELECT * FROM devices WHERE site_id = $1 AND id = $2 AND deleted_at IS NULL", [siteId, deviceId]);
    if (!rows[0]) throw new ApiError(404, "device_not_found", "The device was not found.");
    return deviceRow(rows[0]);
  }

  async createDevice(siteId, input) {
    if (input.parentDeviceId) {
      const { rows: parentRows } = await this.pool.query("SELECT id FROM devices WHERE id=$1 AND site_id=$2 AND deleted_at IS NULL", [input.parentDeviceId, siteId]);
      if (!parentRows[0]) throw new ApiError(400, "invalid_parent_device", "The parent device does not belong to this site.");
    }
    if (input.gatewayId) {
      const { rows: gatewayRows } = await this.pool.query("SELECT id FROM gateways WHERE id=$1 AND site_id=$2", [input.gatewayId, siteId]);
      if (!gatewayRows[0]) throw new ApiError(400, "invalid_gateway", "The selected gateway does not belong to this site.");
    }
    if (input.gatewayPortId) {
      const { rows: portRows } = await this.pool.query(`SELECT p.id,p.gateway_id FROM gateway_ports p JOIN gateways g ON g.id=p.gateway_id
        WHERE p.id=$1 AND g.site_id=$2`, [input.gatewayPortId, siteId]);
      if (!portRows[0] || (input.gatewayId && portRows[0].gateway_id !== input.gatewayId)) {
        throw new ApiError(400, "invalid_gateway_port", "The selected port does not belong to the selected site and gateway.");
      }
    }
    const id = randomUUID();
    const { rows } = await this.pool.query(`
      INSERT INTO devices
        (id, site_id, parent_device_id, gateway_id, gateway_port_id, device_type, name, manufacturer, model,
         serial_number, driver_key, protocol, connection, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,'provisioning')
      RETURNING *`, [id, siteId, input.parentDeviceId, input.gatewayId, input.gatewayPortId, input.type, input.name,
      input.manufacturer, input.model, input.serialNumber, input.driverKey, input.protocol, JSON.stringify(input.connection)]);
    return deviceRow(rows[0]);
  }

  async bindOpenRemoteAsset(deviceId, assetId) {
    const { rows } = await this.pool.query(`
      UPDATE devices SET openremote_asset_id=$2, status='configured', revision=revision+1, updated_at=now()
      WHERE id=$1 RETURNING *`, [deviceId, assetId]);
    if (!rows[0]) throw new ApiError(404, "device_not_found", "The device was not found.");
    await this.pool.query(`
      INSERT INTO openremote_asset_bindings(device_id, openremote_asset_id)
      VALUES ($1,$2) ON CONFLICT (device_id) DO UPDATE SET openremote_asset_id=excluded.openremote_asset_id, updated_at=now()`, [deviceId, assetId]);
    return deviceRow(rows[0]);
  }

  async markDeviceProvisioningFailed(deviceId) {
    await this.pool.query("UPDATE devices SET status='provisioning_failed', updated_at=now() WHERE id=$1", [deviceId]);
  }

  async updateDevice(siteId, deviceId, patch, expectedRevision) {
    const current = await this.getDevice(siteId, deviceId);
    if (current.revision !== expectedRevision) throw new ApiError(412, "stale_revision", "The device configuration has changed.");
    const next = { ...current, ...patch };
    const { rows } = await this.pool.query(`
      UPDATE devices SET name=$3, manufacturer=$4, model=$5, serial_number=$6, driver_key=$7,
        protocol=$8, connection=$9::jsonb, revision=revision+1, updated_at=now()
      WHERE site_id=$1 AND id=$2 AND revision=$10 RETURNING *`, [siteId, deviceId, next.name, next.manufacturer,
      next.model, next.serialNumber, next.driverKey, next.protocol, JSON.stringify(next.connection), expectedRevision]);
    if (!rows[0]) throw new ApiError(412, "stale_revision", "The device configuration has changed.");
    return deviceRow(rows[0]);
  }

  async saveHardwareConfiguration(siteId, input, subject) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`hardware:${siteId}`]);
      const { rows: versions } = await client.query("SELECT COALESCE(MAX(revision),0)+1 AS revision FROM hardware_configurations WHERE site_id=$1", [siteId]);
      const configurationId = randomUUID();
      const revision = Number(versions[0].revision);
      await client.query(`INSERT INTO hardware_configurations(id,site_id,revision,status,created_by)
        VALUES($1,$2,$3,'draft',$4)`, [configurationId, siteId, revision, subject]);
      for (const gateway of input.gateways || []) {
        const gatewayId = gateway.id || randomUUID();
        await client.query(`INSERT INTO gateways(id,hardware_configuration_id,site_id,name,hardware_model,role,management_network)
          VALUES($1,$2,$3,$4,$5,$6,$7::jsonb)`, [gatewayId, configurationId, siteId, gateway.name, gateway.hardwareModel, gateway.role, JSON.stringify(gateway.managementNetwork || {})]);
        for (const port of gateway.ports || []) {
          await client.query(`INSERT INTO gateway_ports(id,gateway_id,name,transport,channel,settings)
            VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [port.id || randomUUID(), gatewayId, port.name, port.transport, port.channel, JSON.stringify(port.settings || {})]);
        }
      }
      await client.query("COMMIT");
      return { id: configurationId, siteId, revision, status: "draft" };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }

  async getSiteConfiguration(siteId, section) {
    const { rows } = await this.pool.query(`SELECT revision,configuration FROM site_configurations
      WHERE site_id=$1 AND section=$2 ORDER BY revision DESC LIMIT 1`, [siteId, section]);
    return rows[0] ? { revision: rows[0].revision, configuration: rows[0].configuration } : { revision: 0, configuration: {} };
  }

  async saveSiteConfiguration(siteId, section, configuration, expectedRevision, subject) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${siteId}:${section}`]);
      const current = await client.query("SELECT COALESCE(MAX(revision),0) AS revision FROM site_configurations WHERE site_id=$1 AND section=$2", [siteId, section]);
      if (Number(current.rows[0].revision) !== expectedRevision) throw new ApiError(412, "stale_revision", "The site configuration has changed.");
      await client.query("UPDATE site_configurations SET status='superseded' WHERE site_id=$1 AND section=$2 AND status='active'", [siteId, section]);
      const revision = expectedRevision + 1;
      await client.query(`INSERT INTO site_configurations(id,site_id,section,revision,configuration,status,created_by)
        VALUES($1,$2,$3,$4,$5::jsonb,'active',$6)`, [randomUUID(), siteId, section, revision, JSON.stringify(configuration), subject]);
      await client.query("COMMIT");
      return { revision, configuration };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async getTopology(siteId) {
    const { rows: configs } = await this.pool.query(`SELECT * FROM hardware_configurations
      WHERE site_id=$1 ORDER BY revision DESC LIMIT 1`, [siteId]);
    const configuration = configs[0] || null;
    const { rows: gateways } = configuration
      ? await this.pool.query("SELECT * FROM gateways WHERE hardware_configuration_id=$1 ORDER BY name", [configuration.id])
      : { rows: [] };
    const gatewayIds = gateways.map((item) => item.id);
    const { rows: ports } = gatewayIds.length
      ? await this.pool.query("SELECT * FROM gateway_ports WHERE gateway_id = ANY($1::uuid[]) ORDER BY gateway_id,name", [gatewayIds])
      : { rows: [] };
    const devices = await this.listDevices(siteId);
    return {
      configuration: configuration ? { id: configuration.id, revision: configuration.revision, status: configuration.status } : null,
      gateways: gateways.map((gateway) => ({
        id: gateway.id, name: gateway.name, hardwareModel: gateway.hardware_model, role: gateway.role,
        ports: ports.filter((port) => port.gateway_id === gateway.id).map((port) => ({
          id: port.id, name: port.name, transport: port.transport, channel: port.channel, settings: port.settings,
        })),
      })),
      devices,
    };
  }

  async getDailyBatteryEconomics(siteId) {
    const { rows } = await this.pool.query(`WITH capacity AS (
        SELECT NULLIF(configuration->>'usableCapacityKwh','')::numeric AS usable_capacity_kwh
        FROM site_configurations WHERE site_id=$1 AND section='battery-asset' AND status='active'
        ORDER BY revision DESC LIMIT 1
      ), totals AS (
        SELECT count(*)::integer AS intervals,
          sum(l.pv_to_battery_kwh)::float8 AS pv_to_battery_kwh,
          sum(l.grid_to_battery_kwh)::float8 AS grid_to_battery_kwh,
          sum(l.battery_to_load_kwh)::float8 AS battery_to_load_kwh,
          sum(l.battery_to_grid_kwh)::float8 AS battery_to_grid_kwh,
          sum(l.charge_kwh)::float8 AS charge_kwh,
          sum(l.discharge_kwh)::float8 AS discharge_kwh,
          sum(l.degradation_cost)::float8 AS degradation_cost,
          sum(l.depreciation_cost)::float8 AS depreciation_cost,
          sum(l.conversion_loss_cost)::float8 AS conversion_loss_cost,
          min(l.currency) AS currency
        FROM battery_energy_ledger_15m l JOIN sites s ON s.id=l.site_id
        WHERE l.site_id=$1 AND (l.interval_start AT TIME ZONE s.timezone)::date=(now() AT TIME ZONE s.timezone)::date
      ) SELECT totals.*,capacity.usable_capacity_kwh::float8 FROM totals LEFT JOIN capacity ON true`, [siteId]);
    const row = rows[0];
    if (!row || row.intervals === 0) return { available: false };
    const capacity = row.usable_capacity_kwh;
    return {
      available: true, currency: row.currency, intervals: row.intervals,
      pvToBatteryKwh: row.pv_to_battery_kwh, gridToBatteryKwh: row.grid_to_battery_kwh,
      batteryToLoadKwh: row.battery_to_load_kwh, batteryToGridKwh: row.battery_to_grid_kwh,
      chargeKwh: row.charge_kwh, dischargeKwh: row.discharge_kwh,
      pvChargeEquivalentCycles: capacity ? row.pv_to_battery_kwh / capacity : null,
      gridChargeEquivalentCycles: capacity ? row.grid_to_battery_kwh / capacity : null,
      equivalentFullCycles: capacity ? (row.charge_kwh + row.discharge_kwh) / (2 * capacity) : null,
      degradationCost: row.degradation_cost, depreciationCost: row.depreciation_cost,
      conversionLossCost: row.conversion_loss_cost,
    };
  }

  async getActiveStrategy(siteId) {
    const { rows } = await this.pool.query(`SELECT id,revision,lifecycle,configuration,created_at,applied_at
      FROM strategy_versions WHERE site_id=$1 AND lifecycle='active' ORDER BY revision DESC LIMIT 1`, [siteId]);
    return rows[0] || null;
  }

  async getStrategyDraft(siteId) {
    const { rows } = await this.pool.query(`SELECT id,revision,lifecycle,configuration,created_at,applied_at
      FROM strategy_versions WHERE site_id=$1 AND lifecycle IN ('draft','ready','invalid') ORDER BY revision DESC LIMIT 1`, [siteId]);
    return rows[0] || null;
  }

  async saveStrategyDraft(siteId, configuration, subject) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`strategy:${siteId}`]);
      const { rows } = await client.query("SELECT COALESCE(MAX(revision),0)+1 AS revision FROM strategy_versions WHERE site_id=$1", [siteId]);
      const revision = Number(rows[0].revision);
      const id = randomUUID();
      await client.query(`INSERT INTO strategy_versions(id,site_id,revision,lifecycle,configuration,created_by)
        VALUES($1,$2,$3,'draft',$4::jsonb,$5)`, [id, siteId, revision, JSON.stringify(configuration), subject]);
      await client.query("COMMIT");
      return { id, revision, lifecycle: "draft", configuration };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async activateStrategy(siteId, revision) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`strategy:${siteId}`]);
      const target = await client.query("SELECT * FROM strategy_versions WHERE site_id=$1 AND revision=$2 FOR UPDATE", [siteId, revision]);
      if (!target.rows[0]) throw new ApiError(404, "strategy_revision_not_found", "The strategy revision was not found.");
      await client.query("UPDATE strategy_versions SET lifecycle='superseded' WHERE site_id=$1 AND lifecycle='active'", [siteId]);
      const { rows } = await client.query(`UPDATE strategy_versions SET lifecycle='active',applied_at=now()
        WHERE site_id=$1 AND revision=$2 RETURNING id,revision,lifecycle,configuration,created_at,applied_at`, [siteId, revision]);
      await client.query("COMMIT");
      return rows[0];
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async listStrategyVersions(siteId) {
    const { rows } = await this.pool.query(`SELECT id,revision,lifecycle,configuration,created_by,created_at,applied_at
      FROM strategy_versions WHERE site_id=$1 ORDER BY revision DESC`, [siteId]);
    return rows;
  }

  async createCanonicalStrategyDraft(siteId, baseRevision, configuration, subject) {
    const active = await this.getActiveStrategy(siteId);
    const activeRevision = active ? Number(active.revision) : 0;
    if (baseRevision !== activeRevision) throw new ApiError(409, "strategy_base_revision_conflict", "The active strategy changed before this draft was created.");
    const id = randomUUID();
    const validation = { valid: false, errors: [], warnings: [] };
    const { rows } = await this.pool.query(`INSERT INTO strategy_drafts
      (id,site_id,base_revision,revision,lifecycle,configuration,validation,created_by)
      VALUES($1,$2,$3,1,'draft',$4::jsonb,$5::jsonb,$6)
      RETURNING *`, [id, siteId, baseRevision, JSON.stringify(configuration), JSON.stringify(validation), subject]);
    return rows[0];
  }

  async getCanonicalStrategyDraft(siteId, draftId) {
    const { rows } = await this.pool.query("SELECT * FROM strategy_drafts WHERE site_id=$1 AND id=$2", [siteId, draftId]);
    if (!rows[0]) throw new ApiError(404, "strategy_draft_not_found", "The strategy draft was not found.");
    return rows[0];
  }

  async updateCanonicalStrategyDraft(siteId, draftId, configuration, expectedRevision) {
    const validation = { valid: false, errors: [], warnings: [] };
    const { rows } = await this.pool.query(`UPDATE strategy_drafts SET configuration=$3::jsonb,revision=revision+1,
      lifecycle='draft',validation=$4::jsonb,simulation_id=NULL,updated_at=now()
      WHERE site_id=$1 AND id=$2 AND revision=$5 AND lifecycle IN ('draft','invalid','ready') RETURNING *`,
    [siteId, draftId, JSON.stringify(configuration), JSON.stringify(validation), expectedRevision]);
    if (!rows[0]) throw new ApiError(412, "stale_revision", "The strategy draft changed or is no longer editable.");
    return rows[0];
  }

  async setCanonicalDraftValidation(siteId, draftId, validation) {
    const lifecycle = validation.valid ? "ready" : "invalid";
    const { rows } = await this.pool.query(`UPDATE strategy_drafts SET validation=$3::jsonb,lifecycle=$4,updated_at=now()
      WHERE site_id=$1 AND id=$2 RETURNING *`, [siteId, draftId, JSON.stringify(validation), lifecycle]);
    if (!rows[0]) throw new ApiError(404, "strategy_draft_not_found", "The strategy draft was not found.");
    return rows[0];
  }

  async queueStrategySimulation(siteId, draftId, draftRevision, input, subject) {
    const id = randomUUID();
    const { rows } = await this.pool.query(`INSERT INTO strategy_simulations
      (id,site_id,draft_id,draft_revision,status,horizon_from,horizon_to,created_by)
      VALUES($1,$2,$3,$4,'queued',$5,$6,$7) RETURNING *`,
    [id, siteId, draftId, draftRevision, input.horizonFrom, input.horizonTo, subject]);
    return rows[0];
  }

  async getCompletedStrategySimulation(siteId, draftId, simulationId) {
    const { rows } = await this.pool.query(`SELECT * FROM strategy_simulations
      WHERE site_id=$1 AND draft_id=$2 AND id=$3 AND status='completed'`, [siteId, draftId, simulationId]);
    return rows[0] || null;
  }

  async requestCanonicalActivation(siteId, draft, simulationId, subject) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`strategy:${siteId}`]);
      const simulation = await client.query(`SELECT id FROM strategy_simulations WHERE site_id=$1 AND draft_id=$2 AND id=$3
        AND draft_revision=$4 AND status='completed'`, [siteId, draft.id, simulationId, draft.revision]);
      if (!simulation.rows[0]) throw new ApiError(409, "strategy_simulation_required", "A completed simulation for the current draft revision is required.");
      const revisions = await client.query("SELECT COALESCE(MAX(revision),0)+1 AS revision FROM strategy_versions WHERE site_id=$1", [siteId]);
      const revision = Number(revisions.rows[0].revision); const id = randomUUID();
      await client.query(`INSERT INTO strategy_versions(id,site_id,revision,lifecycle,configuration,simulation_id,created_by)
        VALUES($1,$2,$3,'activating',$4::jsonb,$5,$6)`, [id, siteId, revision, JSON.stringify(draft.configuration), simulationId, subject]);
      await client.query("UPDATE strategy_drafts SET lifecycle='activating',simulation_id=$3,updated_at=now() WHERE site_id=$1 AND id=$2", [siteId, draft.id, simulationId]);
      await client.query("COMMIT");
      return { id, revision, lifecycle: "activating", configuration: draft.configuration, simulationId };
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  }

  async rejectCanonicalActivation(siteId, revision) {
    await this.pool.query("UPDATE strategy_versions SET lifecycle='rejected' WHERE site_id=$1 AND revision=$2 AND lifecycle='activating'", [siteId, revision]);
  }

  async audit({ principal, siteId = null, action, resourceType, resourceId = null, result, requestId, details = {} }) {
    await this.pool.query(`INSERT INTO audit_events(subject,site_id,action,resource_type,resource_id,result,request_id,details)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`, [principal.subject, siteId, action, resourceType, resourceId, result, requestId, JSON.stringify(details)]);
  }
}

export class MemoryRepository {
  constructor(seed = {}) {
    this.sites = seed.sites || [];
    this.memberships = seed.memberships || [];
    this.devices = seed.devices || [];
    this.topologies = new Map();
    this.preferences = new Map();
    this.configurations = new Map();
    this.strategies = new Map();
    this.strategyDrafts = new Map();
    this.strategySimulations = new Map();
    this.auditEvents = [];
  }
  async migrate() {}
  async close() {}
  async listAccessibleSites(subject) {
    const organisations = new Set(this.memberships.filter((item) => item.subject === subject).map((item) => item.organisationId));
    return this.sites.filter((site) => organisations.has(site.organisationId));
  }
  async getUserPreferences(subject) { return this.preferences.get(subject) || { revision: 0, locale: "en", displayTimezone: "site", units: "metric", currency: "EUR", theme: "system", notifications: { channels: ["email"], minimumSeverity: "warning" } }; }
  async updateUserPreferences(subject, preferences, expectedRevision) {
    const current = await this.getUserPreferences(subject);
    if (current.revision !== expectedRevision) throw new ApiError(412, "stale_revision", "The user preferences have changed.");
    const next = { ...preferences, revision: expectedRevision + 1 }; this.preferences.set(subject, next); return next;
  }
  async requireSite(subject, siteId) {
    const site = (await this.listAccessibleSites(subject)).find((item) => item.id === siteId);
    if (!site) throw new ApiError(404, "site_not_found", "The site was not found or is not accessible.");
    return site;
  }
  async listDevices(siteId) { return this.devices.filter((item) => item.siteId === siteId); }
  async getDevice(siteId, deviceId) {
    const device = this.devices.find((item) => item.siteId === siteId && item.id === deviceId);
    if (!device) throw new ApiError(404, "device_not_found", "The device was not found.");
    return device;
  }
  async createDevice(siteId, input) {
    const device = { id: randomUUID(), siteId, ...input, openremoteAssetId: null, status: "provisioning", revision: 0 };
    this.devices.push(device); return device;
  }
  async bindOpenRemoteAsset(deviceId, assetId) {
    const device = this.devices.find((item) => item.id === deviceId);
    device.openremoteAssetId = assetId; device.status = "configured"; device.revision += 1; return device;
  }
  async markDeviceProvisioningFailed(deviceId) { const device = this.devices.find((item) => item.id === deviceId); if (device) device.status = "provisioning_failed"; }
  async updateDevice(siteId, deviceId, patch, expectedRevision) {
    const device = await this.getDevice(siteId, deviceId);
    if (device.revision !== expectedRevision) throw new ApiError(412, "stale_revision", "The device configuration has changed.");
    Object.assign(device, patch); device.revision += 1; return device;
  }
  async saveHardwareConfiguration(siteId, input) {
    const previous = this.topologies.get(siteId);
    const result = { id: randomUUID(), siteId, revision: (previous?.configuration?.revision || 0) + 1, status: "draft" };
    this.topologies.set(siteId, { configuration: result, gateways: input.gateways || [], devices: await this.listDevices(siteId) }); return result;
  }
  async getSiteConfiguration(siteId, section) { return this.configurations.get(`${siteId}:${section}`) || { revision: 0, configuration: {} }; }
  async saveSiteConfiguration(siteId, section, configuration, expectedRevision) {
    const current = await this.getSiteConfiguration(siteId, section);
    if (current.revision !== expectedRevision) throw new ApiError(412, "stale_revision", "The site configuration has changed.");
    const next = { revision: expectedRevision + 1, configuration }; this.configurations.set(`${siteId}:${section}`, next); return next;
  }
  async getTopology(siteId) { return this.topologies.get(siteId) || { configuration: null, gateways: [], devices: await this.listDevices(siteId) }; }
  async getDailyBatteryEconomics() { return { available: false }; }
  async getActiveStrategy(siteId) { return (this.strategies.get(siteId) || []).find((item) => item.lifecycle === "active") || null; }
  async getStrategyDraft(siteId) { return [...(this.strategies.get(siteId) || [])].reverse().find((item) => item.lifecycle === "draft") || null; }
  async saveStrategyDraft(siteId, configuration) {
    const items = this.strategies.get(siteId) || [];
    const result = { id: randomUUID(), revision: items.length + 1, lifecycle: "draft", configuration };
    items.push(result); this.strategies.set(siteId, items); return result;
  }
  async activateStrategy(siteId, revision) {
    const items = this.strategies.get(siteId) || [];
    const target = items.find((item) => item.revision === revision);
    if (!target) throw new ApiError(404, "strategy_revision_not_found", "The strategy revision was not found.");
    for (const item of items) if (item.lifecycle === "active") item.lifecycle = "superseded";
    target.lifecycle = "active"; target.appliedAt = new Date().toISOString(); return target;
  }
  async listStrategyVersions(siteId) { return (this.strategies.get(siteId) || []).filter((item) => item.lifecycle === "active" || item.lifecycle === "superseded").reverse(); }
  async createCanonicalStrategyDraft(siteId, baseRevision, configuration, subject) {
    const active = await this.getActiveStrategy(siteId); if (baseRevision !== (active?.revision || 0)) throw new ApiError(409, "strategy_base_revision_conflict", "The active strategy changed before this draft was created.");
    const draft = { id: randomUUID(), site_id: siteId, base_revision: baseRevision, revision: 1, lifecycle: "draft", configuration, validation: { valid: false, errors: [], warnings: [] }, created_by: subject, created_at: new Date().toISOString() };
    this.strategyDrafts.set(draft.id, draft); return draft;
  }
  async getCanonicalStrategyDraft(siteId, draftId) { const draft = this.strategyDrafts.get(draftId); if (!draft || draft.site_id !== siteId) throw new ApiError(404, "strategy_draft_not_found", "The strategy draft was not found."); return draft; }
  async updateCanonicalStrategyDraft(siteId, draftId, configuration, expectedRevision) { const draft = await this.getCanonicalStrategyDraft(siteId, draftId); if (draft.revision !== expectedRevision) throw new ApiError(412, "stale_revision", "The strategy draft changed."); Object.assign(draft,{ configuration, revision: draft.revision + 1, lifecycle: "draft", validation: { valid: false, errors: [], warnings: [] }, simulation_id: null }); return draft; }
  async setCanonicalDraftValidation(siteId, draftId, validation) { const draft = await this.getCanonicalStrategyDraft(siteId, draftId); draft.validation = validation; draft.lifecycle = validation.valid ? "ready" : "invalid"; return draft; }
  async queueStrategySimulation(siteId, draftId, draftRevision, input, subject) { const simulation = { id: randomUUID(), site_id: siteId, draft_id: draftId, draft_revision: draftRevision, status: "queued", horizon_from: input.horizonFrom, horizon_to: input.horizonTo, input_versions: {}, projected: null, violations: [], created_by: subject }; this.strategySimulations.set(simulation.id, simulation); return simulation; }
  async getCompletedStrategySimulation(siteId, draftId, simulationId) { const simulation = this.strategySimulations.get(simulationId); return simulation?.site_id === siteId && simulation?.draft_id === draftId && simulation.status === "completed" ? simulation : null; }
  async requestCanonicalActivation(siteId, draft, simulationId, subject) { const simulation = await this.getCompletedStrategySimulation(siteId, draft.id, simulationId); if (!simulation || simulation.draft_revision !== draft.revision) throw new ApiError(409, "strategy_simulation_required", "A completed simulation for the current draft revision is required."); const items=this.strategies.get(siteId)||[]; const result={id:randomUUID(),revision:Math.max(0,...items.map(item=>item.revision))+1,lifecycle:"activating",configuration:draft.configuration,simulationId,created_by:subject}; items.push(result);this.strategies.set(siteId,items);draft.lifecycle="activating";return result; }
  async rejectCanonicalActivation(siteId, revision) { const item=(this.strategies.get(siteId)||[]).find(entry=>entry.revision===revision);if(item)item.lifecycle="rejected"; }
  async audit(event) { this.auditEvents.push(event); }
}

export function createRepository(config) {
  if (config.database) return new PostgresRepository(config.database);
  if (config.allowMemoryDatabase) return new MemoryRepository();
  throw new Error("No GrideX database configured");
}
