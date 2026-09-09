import { ApiError } from "./errors.mjs";

const readMeta = [{ name: "accessRestrictedRead", value: true }];
const telemetryMeta = [...readMeta, { name: "storeDataPoints", value: true }, { name: "readOnly", value: true }];

const attribute = (type, value = null, meta = telemetryMeta) => ({ type, value, meta });

export const DEVICE_BLUEPRINTS = Object.freeze({
  inverter: {
    openRemoteType: "ElectricityProducerAsset",
    capabilities: ["telemetry", "pv-production", "power-limit"],
    attributes: {
      online: attribute("boolean", false),
      actualPowerKw: attribute("number"),
      pvPowerKw: attribute("number"),
      acVoltageV: attribute("number"),
      acCurrentA: attribute("number"),
      gridFrequencyHz: attribute("number"),
      powerFactor: attribute("number"),
      energyTodayKwh: attribute("number"),
      energyTotalKwh: attribute("number"),
      operatingState: attribute("text"),
      alarmCodes: attribute("text", null),
      requestedPowerLimitPct: attribute("number", null, readMeta),
    },
  },
  battery: {
    openRemoteType: "ElectricityBatteryAsset",
    capabilities: ["telemetry", "charge", "discharge", "soc-limits"],
    attributes: {
      online: attribute("boolean", false),
      socPct: attribute("number"),
      sohPct: attribute("number"),
      voltageV: attribute("number"),
      currentA: attribute("number"),
      actualPowerKw: attribute("number"),
      maxChargeKw: attribute("number"),
      maxDischargeKw: attribute("number"),
      temperatureC: attribute("number"),
      energyCapacityKwh: attribute("number", null, readMeta),
      chargeEnergyTotalKwh: attribute("number"),
      dischargeEnergyTotalKwh: attribute("number"),
      operatingState: attribute("text"),
      alarmCodes: attribute("text", null),
    },
  },
  meter: {
    openRemoteType: "ElectricityConsumerAsset",
    capabilities: ["telemetry", "import-export", "software-fuse-input"],
    attributes: {
      online: attribute("boolean", false),
      measurementPoint: attribute("text", "PCC", readMeta),
      activePowerKw: attribute("number"),
      reactivePowerKvar: attribute("number"),
      voltageL1V: attribute("number"),
      voltageL2V: attribute("number"),
      voltageL3V: attribute("number"),
      currentL1A: attribute("number"),
      currentL2A: attribute("number"),
      currentL3A: attribute("number"),
      gridFrequencyHz: attribute("number"),
      powerFactor: attribute("number"),
      importEnergyTotalKwh: attribute("number"),
      exportEnergyTotalKwh: attribute("number"),
      alarmCodes: attribute("text", null),
    },
  },
  evse: {
    openRemoteType: "ElectricityChargerAsset",
    capabilities: ["telemetry", "charge-control", "dynamic-load-limit"],
    attributes: {
      online: attribute("boolean", false),
      connectorState: attribute("text"),
      chargingPowerKw: attribute("number"),
      sessionEnergyKwh: attribute("number"),
      totalEnergyKwh: attribute("number"),
      maximumPowerKw: attribute("number", null, readMeta),
      requestedCurrentLimitA: attribute("number", null, readMeta),
      vehicleConnected: attribute("boolean", false),
      transactionId: attribute("text"),
      alarmCodes: attribute("text", null),
    },
  },
});

export const DEVICE_TYPES = Object.freeze(Object.keys(DEVICE_BLUEPRINTS));

export function validateDeviceInput(input) {
  if (!input || typeof input !== "object") throw new ApiError(400, "invalid_device", "A device object is required.");
  if (!DEVICE_BLUEPRINTS[input.type]) throw new ApiError(400, "invalid_device_type", "Unsupported device type.");
  for (const field of ["name", "manufacturer", "model", "driverKey", "protocol"]) {
    if (typeof input[field] !== "string" || !input[field].trim()) {
      throw new ApiError(400, "invalid_device", `${field} is required.`);
    }
  }
  if (input.serialNumber !== undefined && input.serialNumber !== null && typeof input.serialNumber !== "string") {
    throw new ApiError(400, "invalid_device", "serialNumber must be text.");
  }
  return {
    type: input.type,
    name: input.name.trim(),
    manufacturer: input.manufacturer.trim(),
    model: input.model.trim(),
    serialNumber: typeof input.serialNumber === "string" ? input.serialNumber.trim() || null : null,
    driverKey: input.driverKey.trim(),
    protocol: input.protocol.trim(),
    parentDeviceId: input.parentDeviceId || null,
    gatewayId: input.gatewayId || null,
    gatewayPortId: input.gatewayPortId || null,
    connection: input.connection && typeof input.connection === "object" ? input.connection : {},
  };
}

export function buildOpenRemoteAsset(device, site, overrides = {}) {
  const blueprint = DEVICE_BLUEPRINTS[device.type];
  if (!blueprint) throw new ApiError(400, "invalid_device_type", "Unsupported device type.");
  const identityAttributes = {
    gridexDeviceId: attribute("text", device.id, []),
    manufacturer: attribute("text", device.manufacturer, readMeta),
    model: attribute("text", device.model, readMeta),
    serialNumber: attribute("text", device.serialNumber, []),
    driverKey: attribute("text", device.driverKey, []),
    protocol: attribute("text", device.protocol, readMeta),
  };
  return {
    type: overrides.openRemoteType || blueprint.openRemoteType,
    name: device.name,
    realm: site.openremoteRealm,
    parentId: overrides.parentAssetId || site.openremoteSiteAssetId,
    attributes: { ...identityAttributes, ...structuredClone(blueprint.attributes) },
  };
}

export function publicDeviceCapabilities(type) {
  const blueprint = DEVICE_BLUEPRINTS[type];
  return blueprint ? [...blueprint.capabilities] : [];
}
