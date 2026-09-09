import { publicDeviceCapabilities } from "./asset-blueprints.mjs";

const attribute = (asset, name) => asset?.attributes?.[name];
const raw = (asset, name) => attribute(asset, name)?.value ?? null;
const timestamp = (asset, name) => {
  const value = attribute(asset, name)?.valueTimestamp;
  return Number.isFinite(value) ? new Date(value).toISOString() : null;
};
const number = (asset, name) => {
  const value = raw(asset, name);
  const parsed = typeof value === "number" ? value : Number(value);
  return value !== null && Number.isFinite(parsed) ? parsed : null;
};
const boolean = (asset, name) => {
  const value = raw(asset, name);
  return typeof value === "boolean" ? value : null;
};
const text = (asset, name) => {
  const value = raw(asset, name);
  return typeof value === "string" ? value : null;
};

const DEVICE_FIELDS = Object.freeze({
  inverter: {
    actualPowerKw: "actualPowerKw", pvPowerKw: "pvPowerKw", voltageV: "acVoltageV",
    currentA: "acCurrentA", frequencyHz: "gridFrequencyHz", powerFactor: "powerFactor",
    energyTodayKwh: "energyTodayKwh", energyTotalKwh: "energyTotalKwh",
  },
  battery: {
    socPct: "socPct", sohPct: "sohPct", voltageV: "voltageV", currentA: "currentA",
    actualPowerKw: "actualPowerKw", maximumChargeKw: "maxChargeKw",
    maximumDischargeKw: "maxDischargeKw", temperatureC: "temperatureC",
    chargeEnergyTotalKwh: "chargeEnergyTotalKwh", dischargeEnergyTotalKwh: "dischargeEnergyTotalKwh",
  },
  meter: {
    actualPowerKw: "activePowerKw", reactivePowerKvar: "reactivePowerKvar",
    voltageL1V: "voltageL1V", voltageL2V: "voltageL2V", voltageL3V: "voltageL3V",
    currentL1A: "currentL1A", currentL2A: "currentL2A", currentL3A: "currentL3A",
    frequencyHz: "gridFrequencyHz", powerFactor: "powerFactor",
    importEnergyTotalKwh: "importEnergyTotalKwh", exportEnergyTotalKwh: "exportEnergyTotalKwh",
  },
  evse: {
    chargingPowerKw: "chargingPowerKw", sessionEnergyKwh: "sessionEnergyKwh",
    totalEnergyKwh: "totalEnergyKwh", maximumPowerKw: "maximumPowerKw",
    requestedCurrentLimitA: "requestedCurrentLimitA",
  },
});

export function normalizeDevice(device, asset) {
  const measurements = Object.fromEntries(
    Object.entries(DEVICE_FIELDS[device.type] || {}).map(([canonical, source]) => [canonical, number(asset, source)]),
  );
  const online = boolean(asset, "online");
  const sampleTimes = Object.values(DEVICE_FIELDS[device.type] || {}).map((source) => timestamp(asset, source)).filter(Boolean).sort();
  return {
    id: device.id,
    siteId: device.siteId,
    type: device.type,
    name: device.name,
    manufacturer: device.manufacturer,
    model: device.model,
    protocol: device.protocol,
    driverKey: device.driverKey,
    status: online === true ? "online" : online === false ? "offline" : "unknown",
    quality: online === true ? "GOOD" : online === false ? "STALE" : "INVALID",
    observedAt: sampleTimes.at(-1) || null,
    operatingState: text(asset, device.type === "evse" ? "connectorState" : "operatingState"),
    alarmCodes: text(asset, "alarmCodes"),
    measurementPoint: device.type === "meter" ? text(asset, "measurementPoint") : null,
    capabilities: publicDeviceCapabilities(device.type),
    measurements,
  };
}

const sumPresent = (values) => {
  const available = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return available.length ? available.reduce((sum, value) => sum + value, 0) : null;
};

export function normalizeSiteSnapshot(site, normalizedDevices, strategy = null, control = null) {
  const batteries = normalizedDevices.filter((device) => device.type === "battery");
  const inverters = normalizedDevices.filter((device) => device.type === "inverter");
  const meters = normalizedDevices.filter((device) => device.type === "meter");
  const evses = normalizedDevices.filter((device) => device.type === "evse");
  const battery = batteries[0] || null;
  const pcc = meters.find((device) => device.measurementPoint === "PCC") || meters[0] || null;
  const loadMeter = meters.find((device) => device.measurementPoint === "LOAD") || null;
  const qualities = normalizedDevices.map((device) => device.quality);
  const quality = qualities.includes("INVALID") ? "INVALID" : qualities.includes("STALE") ? "STALE" : qualities.length ? "GOOD" : "INVALID";
  return {
    siteId: site.id,
    siteName: site.name,
    timestamp: new Date().toISOString(),
    quality,
    battery: battery ? {
      deviceId: battery.id,
      socPct: battery.measurements.socPct,
      sohPct: battery.measurements.sohPct,
      maxChargeKw: battery.measurements.maximumChargeKw,
      maxDischargeKw: battery.measurements.maximumDischargeKw,
      limitsValid: boolean(control, "limitsValid"),
      controlReady: boolean(control, "controlReady"),
    } : null,
    power: {
      batteryKw: battery?.measurements.actualPowerKw ?? null,
      pvKw: sumPresent(inverters.map((device) => device.measurements.pvPowerKw ?? device.measurements.actualPowerKw)),
      gridKw: pcc?.measurements.actualPowerKw ?? null,
      siteLoadKw: loadMeter?.measurements.actualPowerKw ?? null,
      evKw: sumPresent(evses.map((device) => device.measurements.chargingPowerKw)),
      requestedKw: number(control, "requestedPowerKw"),
      appliedKw: number(control, "appliedPowerKw"),
    },
    strategy: strategy ? {
      code: text(strategy, "strategyCode") || text(strategy, "mode"),
      desiredRevision: number(strategy, "strategyDesiredRevision"),
      appliedRevision: number(strategy, "strategyAppliedRevision"),
      lifecycle: text(strategy, "strategyLifecycle"),
      targetSocPct: number(strategy, "targetSocPct"),
      economicForecast24h: raw(strategy, "economicForecast24h"),
      cycleForecast24h: raw(strategy, "cycleForecast24h"),
      forecastInputs: raw(strategy, "forecastInputs"),
    } : null,
    devices: normalizedDevices,
  };
}
