import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { principalFromClaims, requirePermission } from "../src/auth.mjs";
import { buildOpenRemoteAsset, validateDeviceInput } from "../src/asset-blueprints.mjs";
import { normalizeDevice, normalizeSiteSnapshot } from "../src/normalizers.mjs";
import { MemoryRepository } from "../src/repository.mjs";
import { createApp } from "../src/app.mjs";
import { validateHardwareConfiguration } from "../src/hardware-config.mjs";
import { calculateBatteryCycleProjection, calculateSaleEconomics } from "../src/economics.mjs";

const site = {
  id: "11111111-1111-4111-8111-111111111111", organisationId: "22222222-2222-4222-8222-222222222222",
  name: "Test Site", timezone: "Europe/Sofia", marketCode: "IBEX", status: "commissioning",
  openremoteRealm: "test", openremoteSiteAssetId: "site-asset", openremoteStrategyAssetId: "strategy-asset", openremoteControlAssetId: "control-asset",
};
const principal = {
  subject: "user-1", email: "operator@example.invalid", name: "Operator", preferredUsername: "operator",
  roles: ["administrator"], permissions: ["site:read", "asset:read", "asset:manage", "hardware:manage", "command:write", "configuration:manage", "strategy:read", "strategy:draft", "strategy:activate"], accessToken: "not-returned-to-browser",
};
const baseConfig = { writesEnabled: true, allowedOrigins: new Set(["https://portal.example.invalid"]), maximumBodyBytes: 131072, snapshotRefreshMs: 10 };

async function withServer(app, callback) {
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("maps Keycloak roles to explicit backend permissions", () => {
  const result = principalFromClaims({ sub: "subject-1", realm_access: { roles: ["operator"] }, resource_access: { "gridex-portal": { roles: ["viewer"] } } }, "access-token", "gridex-portal");
  assert.deepEqual(result.roles.sort(), ["operator", "viewer"]);
  assert.equal(result.permissions.includes("command:write"), true);
  assert.throws(() => requirePermission(result, "asset:manage"), /permission/);
});

test("builds distinct OpenRemote assets for every supported device type", () => {
  for (const type of ["inverter", "battery", "meter", "evse"]) {
    const device = { id: `device-${type}`, type, name: type, manufacturer: "Vendor", model: "Model", serialNumber: null, driverKey: `driver.${type}`, protocol: "modbus-tcp" };
    const asset = buildOpenRemoteAsset(device, site);
    assert.equal(asset.parentId, "site-asset");
    assert.equal(asset.realm, "test");
    assert.equal(asset.attributes.gridexDeviceId.value, device.id);
    assert.ok(asset.attributes.online);
  }
});

test("normalization preserves missing telemetry as null instead of unsafe zero", () => {
  const device = { id: "battery-1", siteId: site.id, type: "battery", name: "BESS", manufacturer: "Vendor", model: "Model", driverKey: "battery", protocol: "modbus-tcp" };
  const live = normalizeDevice(device, { attributes: { online: { value: true }, socPct: { value: 72, valueTimestamp: 1700000000000 } } });
  assert.equal(live.measurements.socPct, 72);
  assert.equal(live.measurements.maximumChargeKw, null);
  const snapshot = normalizeSiteSnapshot(site, [live]);
  assert.equal(snapshot.power.gridKw, null);
  assert.equal(snapshot.battery.maxChargeKw, null);
});

test("site listing is filtered by database membership", async () => {
  const repository = new MemoryRepository({ sites: [site, { ...site, id: "33333333-3333-4333-8333-333333333333", organisationId: "other" }], memberships: [{ subject: "user-1", organisationId: site.organisationId }] });
  const app = createApp({ config: baseConfig, authenticate: async () => principal, repository, openRemote: { health: async () => true } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/sites`, { headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid" } });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.deepEqual(payload.sites.map((item) => item.id), [site.id]);
    assert.equal(JSON.stringify(payload).includes("openremote"), false);
  });
});

test("provisions a device in OpenRemote and returns only public configuration", async () => {
  const repository = new MemoryRepository({ sites: [site], memberships: [{ subject: "user-1", organisationId: site.organisationId }] });
  let createdAsset;
  const openRemote = { health: async () => true, createAsset: async (asset) => { createdAsset = asset; return { ...asset, id: "openremote-device-1" }; } };
  const app = createApp({ config: baseConfig, authenticate: async () => principal, repository, openRemote });
  await withServer(app, async (baseUrl) => {
    const input = validateDeviceInput({ type: "inverter", name: "PV inverter", manufacturer: "Deye", model: "SUN", driverKey: "solarman.deye_p3", protocol: "modbus-tcp", connection: { endpointRef: "site-lan-device-1" } });
    const response = await fetch(`${baseUrl}/api/v1/sites/${site.id}/devices`, { method: "POST", headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid", "Content-Type": "application/json" }, body: JSON.stringify(input) });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.status, "configured");
    assert.equal(payload.openremoteAssetId, undefined);
    assert.equal(payload.connection, undefined);
    assert.equal(createdAsset.type, "ElectricityProducerAsset");
    assert.equal(repository.auditEvents[0].action, "device.provisioned");
  });
});

test("rejects asset management when the commissioning write lock is closed", async () => {
  const repository = new MemoryRepository({ sites: [site], memberships: [{ subject: "user-1", organisationId: site.organisationId }] });
  const app = createApp({ config: { ...baseConfig, writesEnabled: false }, authenticate: async () => principal, repository, openRemote: { health: async () => true } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/sites/${site.id}/devices`, { method: "POST", headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid", "Content-Type": "application/json" }, body: JSON.stringify({ type: "meter" }) });
    assert.equal(response.status, 423);
    assert.equal((await response.json()).error, "writes_locked");
  });
});

test("validates one ROCK Pi E controller and dedicated gateway nodes", () => {
  const topology = validateHardwareConfiguration({ gateways: [
    { name: "Controller", hardwareModel: "rock-pi-e", role: "controller", ports: [{ name: "OT", transport: "modbus-tcp", channel: "lan0" }] },
    { name: "Inverter node", hardwareModel: "olimex-esp32-evb-ea-ind", role: "device-node", ports: [{ name: "CAN", transport: "can", channel: "can0" }] },
  ] });
  assert.equal(topology.gateways.length, 2);
  assert.throws(() => validateHardwareConfiguration({ gateways: [topology.gateways[1]] }), /ROCK Pi E/);
});

test("stores per-user preferences with optimistic revision control", async () => {
  const repository = new MemoryRepository();
  const app = createApp({ config: baseConfig, authenticate: async () => principal, repository, openRemote: { health: async () => true } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/me/preferences`, { method: "PUT", headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid", "Content-Type": "application/json", "If-Match": "0" }, body: JSON.stringify({ locale: "bg", theme: "dark" }) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).revision, 1);
    const stale = await fetch(`${baseUrl}/api/v1/me/preferences`, { method: "PUT", headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid", "Content-Type": "application/json", "If-Match": "0" }, body: JSON.stringify({ locale: "en" }) });
    assert.equal(stale.status, 412);
  });
});

test("creates a canonical strategy draft with economic loss protection", async () => {
  const repository = new MemoryRepository({ sites: [site], memberships: [{ subject: "user-1", organisationId: site.organisationId }] });
  const openRemote = { health: async () => true };
  const app = createApp({ config: baseConfig, authenticate: async () => principal, repository, openRemote });
  await withServer(app, async (baseUrl) => {
    const headers = { Authorization: "Bearer test", Origin: "https://portal.example.invalid", "Content-Type": "application/json" };
    const draftResponse = await fetch(`${baseUrl}/api/v1/sites/${site.id}/strategy/drafts`, { method: "POST", headers, body: JSON.stringify({ baseRevision: 0, configuration: { code: "intelligent_hybrid", minSocPct: 20, maxSocPct: 90, reserveSocPct: 70, weatherAware: true, allowGridCharging: true, economics: { priceForecastSources: [{ source: "day-ahead-model" }, { source: "market-ensemble" }], lossProtection: { enabled: true, mode: "full_cost" } } } }) });
    assert.equal(draftResponse.status, 201);
    const draft = await draftResponse.json();
    assert.equal(draft.configuration.code, "intelligent_hybrid");
    assert.equal(draft.configuration.economics.lossProtection.mode, "full_cost");
    assert.equal(draft.configuration.economics.cycleForecastHorizonHours, 24);
    assert.equal(draft.configuration.forecast.modelKey, "lightgbm_v1");
  });
});

test("lists the selectable forecast and optimisation models", async () => {
  const repository = new MemoryRepository({ sites: [site], memberships: [{ subject: "user-1", organisationId: site.organisationId }] });
  const app = createApp({ config: baseConfig, authenticate: async () => principal, repository, openRemote: { health: async () => true } });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/v1/sites/${site.id}/forecast/models`, { headers: { Authorization: "Bearer test", Origin: "https://portal.example.invalid" } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).items.map((item) => item.key), ["lightgbm_v1", "anguelov_ibex_milp_v1"]);
  });
});

test("uses distinct PV-direct and battery sale cost paths", () => {
  const pv = calculateSaleEconomics({ path: "pv_direct", marketSalePricePerMwh: 80, traderFeePerMwh: 3, pvVariableCostPerMwh: 5, policy: { mode: "full_cost", minimumMarginPerMwh: 2 } });
  const battery = calculateSaleEconomics({ path: "battery_discharge", marketSalePricePerMwh: 70, traderFeePerMwh: 3, sourceEnergyCostPerMwh: 50, batteryRoundTripEfficiency: 0.9, batteryDegradationPerMwh: 15, policy: { mode: "full_cost", minimumMarginPerMwh: 2 } });
  assert.equal(pv.saleAllowed, true);
  assert.equal(battery.saleAllowed, false);
  assert.equal(pv.components.batteryDegradationPerMwh, 0);
  assert.equal(battery.components.batteryDegradationPerMwh, 15);
});

test("attributes 24-hour charge-equivalent cycles to grid and PV", () => {
  const projection = calculateBatteryCycleProjection({ usableCapacityKwh: 200, gridChargeKwh: 100, pvChargeKwh: 50, dischargeKwh: 140, horizonHours: 24 });
  assert.equal(projection.gridChargeEquivalentCycles, 0.5);
  assert.equal(projection.pvChargeEquivalentCycles, 0.25);
  assert.equal(projection.equivalentFullCycles, 0.725);
});
