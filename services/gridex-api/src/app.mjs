import { randomUUID } from "node:crypto";
import { assertAllowedOrigin } from "./config.mjs";
import { requirePermission } from "./auth.mjs";
import { ApiError, toErrorResponse } from "./errors.mjs";
import { buildOpenRemoteAsset, DEVICE_TYPES, validateDeviceInput } from "./asset-blueprints.mjs";
import { normalizeDevice, normalizeSiteSnapshot } from "./normalizers.mjs";
import { SUPPORTED_HARDWARE, validateHardwareConfiguration } from "./hardware-config.mjs";
import { STRATEGY_CODES, validateStrategyConfiguration } from "./strategy-config.mjs";
import { CONFIGURATION_SECTIONS, validateConfiguration } from "./configuration-centre.mjs";

const CONFIGURATION_SECTION_SET = new Set(CONFIGURATION_SECTIONS);
const STRATEGY_CATALOG = STRATEGY_CODES.map((code) => ({
  code,
  label: { en: code.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "), bg: code },
  description: { en: "Versioned site strategy with validation and simulation before activation.", bg: "Версионирана стратегия с проверка и симулация преди активиране." },
  requiredCapabilities: code === "manual" ? ["control"] : ["telemetry", "control"],
  requiredRoles: code === "manual" ? ["operator"] : ["operator", "energy_manager"],
  simulationRequired: code !== "manual",
}));

function cors(res, config, origin) {
  if (origin && config.allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, Idempotency-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "ETag, X-Request-Id");
}

function json(res, status, body, context) {
  const payload = JSON.stringify(body);
  cors(res, context.config, context.origin);
  res.setHeader("X-Request-Id", context.requestId);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJson(req, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximumBytes) throw new ApiError(413, "request_too_large", "The request body is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new ApiError(400, "invalid_json", "The request body is not valid JSON."); }
}

function expectedRevision(req) {
  const raw = req.headers["if-match"];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value < 0) throw new ApiError(428, "revision_required", "If-Match with the current numeric revision is required.");
  return value;
}

function publicSite(site) {
  return { id: site.id, organisationId: site.organisationId, name: site.name, timezone: site.timezone, marketCode: site.marketCode, status: site.status };
}

function publicDeviceConfiguration(device) {
  return {
    id: device.id, siteId: device.siteId, parentDeviceId: device.parentDeviceId, gatewayId: device.gatewayId, gatewayPortId: device.gatewayPortId,
    type: device.type, name: device.name, manufacturer: device.manufacturer, model: device.model,
    serialNumber: device.serialNumber, driverKey: device.driverKey, protocol: device.protocol,
    status: device.status, revision: device.revision,
  };
}

function canonicalStrategyDraft(row, siteId) {
  return {
    siteId, draftId: row.id, baseRevision: Number(row.base_revision ?? 0), revision: Number(row.revision),
    etag: String(row.revision), lifecycle: row.lifecycle, configuration: row.configuration,
    validation: row.validation || { valid: false, errors: [], warnings: [] },
    createdAt: row.created_at || new Date().toISOString(), createdBy: row.created_by || "",
  };
}

function canonicalStrategyVersion(row, siteId) {
  return row ? {
    siteId, revision: Number(row.revision), etag: String(row.revision), lifecycle: row.lifecycle,
    configuration: row.configuration, createdAt: row.created_at || new Date().toISOString(),
    createdBy: row.created_by || "", appliedAt: row.applied_at || row.appliedAt || null,
  } : null;
}

async function loadSiteDevices(site, repository, openRemote) {
  const devices = await repository.listDevices(site.id);
  const configured = devices.filter((device) => device.openremoteAssetId);
  const assets = await openRemote.getManagedAssets(configured.map((device) => device.openremoteAssetId));
  return configured.map((device, index) => normalizeDevice(device, assets[index]));
}

async function loadDeviceRecords(site, repository, openRemote) {
  const devices = await repository.listDevices(site.id);
  const configured = devices.filter((device) => device.openremoteAssetId);
  const assets = await openRemote.getManagedAssets(configured.map((device) => device.openremoteAssetId));
  const liveByDeviceId = new Map(configured.map((device, index) => [device.id, normalizeDevice(device, assets[index])]));
  return devices.map((device) => ({ ...publicDeviceConfiguration(device), live: liveByDeviceId.get(device.id) || null }));
}

async function loadSnapshot(site, repository, openRemote) {
  const devices = await loadSiteDevices(site, repository, openRemote);
  const [strategy, control, batteryEconomicsToday] = await Promise.all([
    site.openremoteStrategyAssetId ? openRemote.getManagedAsset(site.openremoteStrategyAssetId) : null,
    site.openremoteControlAssetId ? openRemote.getManagedAsset(site.openremoteControlAssetId) : null,
    repository.getDailyBatteryEconomics(site.id),
  ]);
  return { ...normalizeSiteSnapshot(site, devices, strategy, control), batteryEconomicsToday };
}

export function createApp({ config, authenticate, repository, openRemote }) {
  return async function app(req, res) {
    const requestId = req.headers["x-request-id"]?.toString().slice(0, 128) || randomUUID();
    const origin = req.headers.origin;
    const context = { config, origin, requestId };
    try {
      assertAllowedOrigin(config, origin);
      if (req.method === "OPTIONS") { cors(res, config, origin); res.writeHead(204); return res.end(); }
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        const online = await openRemote.health();
        return json(res, online ? 200 : 503, { status: online ? "ready" : "degraded", openRemote: online ? "online" : "offline", writesEnabled: config.writesEnabled }, context);
      }

      const principal = await authenticate(req);

      if (req.method === "GET" && url.pathname === "/api/v1/me") {
        return json(res, 200, {
          subject: principal.subject, email: principal.email, name: principal.name,
          preferredUsername: principal.preferredUsername, roles: principal.roles, permissions: principal.permissions,
        }, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/me/preferences") {
        return json(res, 200, await repository.getUserPreferences(principal.subject), context);
      }

      if (req.method === "PUT" && url.pathname === "/api/v1/me/preferences") {
        const input = await readJson(req, config.maximumBodyBytes);
        const updated = await repository.updateUserPreferences(principal.subject, input, expectedRevision(req));
        res.setHeader("ETag", String(updated.revision));
        return json(res, 200, updated, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/device-types") {
        requirePermission(principal, "asset:read");
        return json(res, 200, { items: DEVICE_TYPES, hardware: SUPPORTED_HARDWARE }, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/strategies/catalog") {
        requirePermission(principal, "strategy:read");
        return json(res, 200, { items: STRATEGY_CATALOG }, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/sites") {
        requirePermission(principal, "site:read");
        const sites = await repository.listAccessibleSites(principal.subject);
        return json(res, 200, { sites: sites.map(publicSite) }, context);
      }

      const siteRoute = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)(\/.*)?$/);
      if (!siteRoute) throw new ApiError(404, "not_found", "The requested API route does not exist.");
      const siteId = decodeURIComponent(siteRoute[1]);
      const suffix = siteRoute[2] || "";
      const site = await repository.requireSite(principal.subject, siteId);

      if (req.method === "GET" && suffix === "/hardware") {
        requirePermission(principal, "site:read");
        const topology = await repository.getTopology(site.id);
        return json(res, 200, { ...topology, devices: topology.devices.map(publicDeviceConfiguration) }, context);
      }

      if (req.method === "POST" && suffix === "/hardware-configurations") {
        requirePermission(principal, "hardware:manage");
        const input = validateHardwareConfiguration(await readJson(req, config.maximumBodyBytes));
        const result = await repository.saveHardwareConfiguration(site.id, input, principal.subject);
        await repository.audit({ principal, siteId, action: "hardware.configuration.created", resourceType: "hardware_configuration", resourceId: result.id, result: "success", requestId, details: { revision: result.revision } });
        return json(res, 201, result, context);
      }

      const configurationRoute = suffix.match(/^\/configurations\/([^/]+)(\/(?:validate|simulate|activate))?$/);
      if (configurationRoute && req.method === "GET") {
        requirePermission(principal, "site:read");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTION_SET.has(section) || configurationRoute[2]) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        return json(res, 200, { section, ...(await repository.getSiteConfiguration(site.id, section)) }, context);
      }

      if (configurationRoute && req.method === "PUT" && !configurationRoute[2]) {
        requirePermission(principal, "configuration:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Configuration writes are locked until commissioning.");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTION_SET.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = body.configuration && typeof body.configuration === "object" ? body.configuration : body;
        const updated = await repository.saveSiteConfiguration(site.id, section, configuration, expectedRevision(req), principal.subject);
        await repository.audit({ principal, siteId, action: "site.configuration.updated", resourceType: "site_configuration", resourceId: section, result: "success", requestId, details: { revision: updated.revision } });
        res.setHeader("ETag", String(updated.revision));
        return json(res, 200, { section, ...updated }, context);
      }

      if (configurationRoute && req.method === "POST" && configurationRoute[2] === "/validate") {
        requirePermission(principal, "configuration:manage");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTION_SET.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        const current = await repository.getSiteConfiguration(site.id, section);
        const validation = validateConfiguration(section, current.configuration);
        await repository.setConfigurationValidation(site.id, section, current.revision, validation);
        return json(res, 200, validation, context);
      }

      if (configurationRoute && req.method === "POST" && configurationRoute[2] === "/simulate") {
        requirePermission(principal, "configuration:manage");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTION_SET.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        const current = await repository.getSiteConfiguration(site.id, section);
        if (!current.validation?.valid) throw new ApiError(409, "configuration_validation_required", "Validate the current configuration before simulation.");
        const simulation = await repository.setConfigurationSimulation(site.id, section, current.revision, {
          simulationId: randomUUID(), status: "completed", createdAt: new Date().toISOString(),
        });
        return json(res, 202, simulation, context);
      }

      if (configurationRoute && req.method === "POST" && configurationRoute[2] === "/activate") {
        requirePermission(principal, "configuration:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Configuration activation is locked until commissioning.");
        const idempotencyKey = req.headers["idempotency-key"]?.toString();
        if (!idempotencyKey) throw new ApiError(428, "idempotency_key_required", "Idempotency-Key is required for activation.");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTION_SET.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        const body = await readJson(req, config.maximumBodyBytes);
        const result = await repository.requestConfigurationActivation(site.id, section, Number(body.revision), body.simulationId, idempotencyKey, principal.subject);
        await repository.audit({ principal, siteId, action: "site.configuration.activation_requested", resourceType: "site_configuration", resourceId: result.id, result: "success", requestId, details: { section, revision: result.revision } });
        return json(res, 202, result, context);
      }

      if (req.method === "GET" && suffix === "/strategy") {
        requirePermission(principal, "strategy:read");
        const active = await repository.getActiveStrategy(site.id);
        return json(res, 200, { strategy: canonicalStrategyVersion(active, site.id) }, context);
      }

      if (req.method === "POST" && suffix === "/strategy/drafts") {
        requirePermission(principal, "strategy:draft");
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = validateStrategyConfiguration(body.configuration);
        const baseRevision = Number(body.baseRevision ?? 0);
        if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new ApiError(400, "invalid_base_revision", "baseRevision must be a non-negative integer.");
        const draft = await repository.createCanonicalStrategyDraft(site.id, baseRevision, configuration, principal.subject);
        return json(res, 201, canonicalStrategyDraft(draft, site.id), context);
      }

      const canonicalDraftRoute = suffix.match(/^\/strategy\/drafts\/([^/]+)(\/(?:validate|simulate|activate))?$/);
      if (canonicalDraftRoute && req.method === "PUT" && !canonicalDraftRoute[2]) {
        requirePermission(principal, "strategy:draft");
        const draftId = decodeURIComponent(canonicalDraftRoute[1]);
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = validateStrategyConfiguration(body.configuration);
        const draft = await repository.updateCanonicalStrategyDraft(site.id, draftId, configuration, expectedRevision(req));
        return json(res, 200, canonicalStrategyDraft(draft, site.id), context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/validate") {
        requirePermission(principal, "strategy:draft");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        validateStrategyConfiguration(draft.configuration);
        const devices = await repository.listDevices(site.id);
        const errors = devices.some((device) => device.type === "battery") ? [] : [{ path: "/battery", code: "battery_missing", message: "A commissioned battery is required for this strategy." }];
        const warnings = devices.some((device) => device.type === "meter") ? [] : [{ path: "/grid", code: "pcc_meter_missing", message: "A PCC meter is required before commissioning." }];
        const validation = { valid: errors.length === 0, errors, warnings };
        await repository.setCanonicalDraftValidation(site.id, draft.id, validation);
        return json(res, 200, validation, context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/simulate") {
        requirePermission(principal, "strategy:simulate");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        if (!draft.validation?.valid) throw new ApiError(409, "strategy_validation_required", "Validate the current draft before simulation.");
        const body = await readJson(req, config.maximumBodyBytes);
        const from = Date.parse(body.horizonFrom); const to = Date.parse(body.horizonTo);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 7 * 86400000) throw new ApiError(400, "invalid_simulation_horizon", "Simulation horizon must be valid and no longer than 168 hours.");
        const simulation = await repository.queueStrategySimulation(site.id, draft.id, draft.revision, body, principal.subject);
        return json(res, 202, { simulationId: simulation.id, draftId: draft.id, status: simulation.status, horizonFrom: simulation.horizon_from, horizonTo: simulation.horizon_to, inputVersions: simulation.input_versions || {}, violations: simulation.violations || [] }, context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/activate") {
        requirePermission(principal, "strategy:activate");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Strategy activation is locked until commissioning.");
        if (!req.headers["idempotency-key"]) throw new ApiError(428, "idempotency_key_required", "Idempotency-Key is required for activation.");
        if (!site.openremoteStrategyAssetId) throw new ApiError(409, "strategy_asset_missing", "The site Strategy Asset is not configured.");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        const body = await readJson(req, config.maximumBodyBytes);
        if (body.expectedDraftRevision !== draft.revision) throw new ApiError(412, "stale_revision", "The strategy draft changed before activation.");
        const requested = await repository.requestCanonicalActivation(site.id, draft, body.simulationId, principal.subject);
        try {
          await openRemote.writeManagedAttribute(site.openremoteStrategyAssetId, "strategyDocument", { revision: requested.revision, configuration: requested.configuration });
        } catch (error) { await repository.rejectCanonicalActivation(site.id, requested.revision); throw error; }
        await repository.audit({ principal, siteId, action: "strategy.activation.requested", resourceType: "strategy", resourceId: requested.id, result: "accepted", requestId, details: { revision: requested.revision } });
        return json(res, 202, { siteId: site.id, code: requested.configuration.code, lifecycle: "activating", desiredRevision: requested.revision, rejectionReasons: [], safety: { limitsValid: false, controlReady: false, writesEnabled: config.writesEnabled, edgeOnline: false } }, context);
      }

      if (req.method === "GET" && suffix === "/strategy/versions") {
        requirePermission(principal, "strategy:read");
        const versions = await repository.listStrategyVersions(site.id);
        return json(res, 200, { items: versions.map((item) => canonicalStrategyVersion(item, site.id)) }, context);
      }

      if (req.method === "GET" && suffix === "/strategy/status") {
        requirePermission(principal, "strategy:read");
        const versions = await repository.listStrategyVersions(site.id);
        const desired = versions[0] || null;
        const asset = site.openremoteStrategyAssetId ? await openRemote.getManagedAsset(site.openremoteStrategyAssetId) : null;
        const attributeValue = (name) => asset?.attributes?.[name]?.value ?? null;
        return json(res, 200, { siteId: site.id, code: desired?.configuration?.code || attributeValue("strategyCode"), lifecycle: attributeValue("strategyLifecycle") || desired?.lifecycle || "draft", desiredRevision: desired?.revision || 0, appliedRevision: attributeValue("strategyAppliedRevision"), rejectionReasons: attributeValue("strategyLastError") ? [attributeValue("strategyLastError")] : [], safety: { limitsValid: attributeValue("limitsValid") === true, controlReady: attributeValue("controlReady") === true, writesEnabled: config.writesEnabled, edgeOnline: attributeValue("edgeOnline") === true } }, context);
      }

      if (req.method === "GET" && ["/devices", "/assets"].includes(suffix)) {
        requirePermission(principal, "asset:read");
        return json(res, 200, { items: await loadDeviceRecords(site, repository, openRemote) }, context);
      }

      if (req.method === "POST" && ["/devices", "/assets"].includes(suffix)) {
        requirePermission(principal, "asset:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Asset provisioning is locked until commissioning.");
        const input = validateDeviceInput(await readJson(req, config.maximumBodyBytes));
        const device = await repository.createDevice(site.id, input);
        try {
          const asset = await openRemote.createAsset(buildOpenRemoteAsset(device, site));
          const configured = await repository.bindOpenRemoteAsset(device.id, asset.id);
          await repository.audit({ principal, siteId, action: "device.provisioned", resourceType: "device", resourceId: device.id, result: "success", requestId, details: { type: device.type } });
          return json(res, 201, publicDeviceConfiguration(configured), context);
        } catch (error) {
          await repository.markDeviceProvisioningFailed(device.id);
          await repository.audit({ principal, siteId, action: "device.provisioned", resourceType: "device", resourceId: device.id, result: "failed", requestId, details: { type: device.type } });
          throw error;
        }
      }

      const deviceRoute = suffix.match(/^\/(?:devices|assets)\/([^/]+)$/);
      if (deviceRoute && req.method === "GET") {
        requirePermission(principal, "asset:read");
        const device = await repository.getDevice(site.id, decodeURIComponent(deviceRoute[1]));
        if (!device.openremoteAssetId) return json(res, 200, { ...publicDeviceConfiguration(device), live: null }, context);
        const asset = await openRemote.getManagedAsset(device.openremoteAssetId);
        return json(res, 200, { ...publicDeviceConfiguration(device), live: normalizeDevice(device, asset) }, context);
      }

      if (deviceRoute && req.method === "PATCH") {
        requirePermission(principal, "asset:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Asset management is locked until commissioning.");
        const deviceId = decodeURIComponent(deviceRoute[1]);
        const current = await repository.getDevice(site.id, deviceId);
        const patch = await readJson(req, config.maximumBodyBytes);
        const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => ["name", "manufacturer", "model", "serialNumber", "driverKey", "protocol", "connection"].includes(key)));
        const validated = validateDeviceInput({ ...current, ...allowed });
        const updated = await repository.updateDevice(site.id, deviceId, Object.fromEntries(Object.entries(validated).filter(([key]) => Object.hasOwn(allowed, key))), expectedRevision(req));
        if (updated.openremoteAssetId) {
          const existing = await openRemote.getManagedAsset(updated.openremoteAssetId);
          const identity = { manufacturer: updated.manufacturer, model: updated.model, serialNumber: updated.serialNumber, driverKey: updated.driverKey, protocol: updated.protocol };
          const attributes = { ...existing.attributes };
          for (const [name, value] of Object.entries(identity)) if (attributes[name]) attributes[name] = { ...attributes[name], value };
          await openRemote.updateAsset(updated.openremoteAssetId, { ...existing, name: updated.name, attributes });
        }
        await repository.audit({ principal, siteId, action: "device.updated", resourceType: "device", resourceId: deviceId, result: "success", requestId, details: { previousRevision: current.revision, revision: updated.revision } });
        res.setHeader("ETag", String(updated.revision));
        return json(res, 200, publicDeviceConfiguration(updated), context);
      }

      if (req.method === "GET" && suffix === "/snapshot") {
        requirePermission(principal, "asset:read");
        return json(res, 200, await loadSnapshot(site, repository, openRemote), context);
      }

      if (req.method === "GET" && suffix === "/events") {
        requirePermission(principal, "asset:read");
        cors(res, config, origin);
        res.setHeader("X-Request-Id", requestId);
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" });
        let closed = false;
        req.on("close", () => { closed = true; });
        let previous = "";
        while (!closed) {
          try {
            const snapshot = await loadSnapshot(site, repository, openRemote);
            const serialized = JSON.stringify(snapshot);
            if (serialized !== previous) { res.write(`event: snapshot\ndata: ${serialized}\n\n`); previous = serialized; }
            else res.write(": keepalive\n\n");
          } catch (error) {
            res.write(`event: upstream-error\ndata: ${JSON.stringify({ error: error.code || "openremote_error", requestId })}\n\n`);
          }
          await new Promise((resolve) => setTimeout(resolve, config.snapshotRefreshMs));
        }
        return;
      }

      if (req.method === "POST" && suffix === "/commands/power") {
        requirePermission(principal, "command:write");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Control writes are locked until commissioning.");
        if (!site.openremoteControlAssetId) throw new ApiError(409, "control_asset_missing", "The site Control Asset is not configured.");
        const command = await readJson(req, config.maximumBodyBytes);
        if (!Number.isInteger(command.sequence) || !Number.isFinite(command.requestedPowerKw) || typeof command.enable !== "boolean") {
          throw new ApiError(400, "invalid_command", "sequence, requestedPowerKw and enable are required.");
        }
        const payload = { ...command, requestedAt: new Date().toISOString(), requestedBy: principal.subject, ttlSeconds: command.ttlSeconds || 15 };
        await openRemote.writeManagedAttribute(site.openremoteControlAssetId, "powerCommand", payload);
        await repository.audit({ principal, siteId, action: "control.power.requested", resourceType: "control", resourceId: site.openremoteControlAssetId, result: "accepted", requestId, details: { sequence: command.sequence } });
        return json(res, 202, { accepted: true, sequence: command.sequence, commandId: requestId }, context);
      }

      throw new ApiError(404, "not_found", "The requested API route does not exist.");
    } catch (error) {
      const response = toErrorResponse(error, requestId);
      return json(res, response.status, response.body, context);
    }
  };
}
