import { ApiError } from "./errors.mjs";

export const CONFIGURATION_SECTIONS = Object.freeze([
  "site", "pv", "battery_pcs", "metering_grid", "market_tariffs",
  "forecast", "strategy", "loads_ev", "edge_devices", "notifications_access",
]);

const required = (object, keys, prefix="") => keys.flatMap((key) => {
  const value = object?.[key];
  return value === undefined || value === null || value === ""
    ? [{ path: `${prefix}/${key}`, code: "required", message: `${key} is required.` }]
    : [];
});

function validatePv(payload) {
  const errors = [];
  if (!Array.isArray(payload.arrays) || payload.arrays.length === 0) return [{ path: "/arrays", code: "required", message: "At least one PV array is required." }];
  payload.arrays.forEach((array, index) => {
    const path = `/arrays/${index}`;
    errors.push(...required(array, ["name","enabled","orientationProfile","mountingType","trackingType","dcKwp","tiltDeg","azimuthDeg","performanceRatio","inverterDeviceId"], path));
    if (!(array.dcKwp > 0)) errors.push({ path:`${path}/dcKwp`, code:"range", message:"DC kWp must be greater than zero." });
    if (!(array.tiltDeg >= 0 && array.tiltDeg <= 90)) errors.push({ path:`${path}/tiltDeg`, code:"range", message:"Tilt must be between 0 and 90 degrees." });
    if (!(array.azimuthDeg >= 0 && array.azimuthDeg < 360)) errors.push({ path:`${path}/azimuthDeg`, code:"range", message:"Azimuth must be between 0 and less than 360 degrees." });
    if (array.trackingType !== "fixed" && !["1P","2P"].includes(array.moduleLayout)) errors.push({ path:`${path}/moduleLayout`, code:"conditional_required", message:"1P or 2P module layout is required for a tracker." });
    if (array.orientationProfile === "east_west") {
      const east = array.eastWestSplitPct?.east; const west = array.eastWestSplitPct?.west;
      if (!Number.isFinite(east) || !Number.isFinite(west) || east + west !== 100) errors.push({ path:`${path}/eastWestSplitPct`, code:"conditional_required", message:"East and west shares are required and must total 100%." });
    }
  });
  return errors;
}

export function validateConfiguration(section, payload) {
  if (!CONFIGURATION_SECTIONS.includes(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new ApiError(400, "invalid_configuration", "Configuration must be an object.");
  let errors = [];
  if (section === "site") errors = required(payload, ["name","siteCode","countryCode","timezone","marketCode","latitude","longitude"]);
  if (section === "pv") errors = validatePv(payload);
  if (section === "battery_pcs") errors = required(payload, ["systemType","coupling","manufacturer","model","usableCapacityKwh","ratedPcsPowerKw","minimumSocPct","maximumSocPct","assetValueEur","usefulLifeMonths"]);
  if (section === "metering_grid") errors = required(payload, ["pccMeterDeviceId","signConvention","maximumImportKw","maximumExportKw","softwareFuseMarginKw","meterUnavailableMode"]);
  if (section === "market_tariffs") errors = required(payload, ["currency","dayAheadSource","validFrom","components"]);
  if (section === "forecast") errors = required(payload, ["priceModels","weatherProvider","pvModel","loadModel","horizonHours","resolutionMinutes","minimumConfidencePct","maximumAgeMinutes"]);
  if (section === "strategy") errors = required(payload, ["code","fallbackMode","controlIntervalSeconds","reoptimiseMinutes","lossProtection"]);
  if (section === "edge_devices") errors = required(payload, ["controller","gateways"]);
  return { valid: errors.length === 0, errors, warnings: [] };
}
