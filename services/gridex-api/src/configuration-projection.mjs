import { ApiError } from "./errors.mjs";

const protectedAttributes = new Set([
  "requestedPowerKw", "powerCommand", "commandSequence", "operatorSequence",
  "operatorApplyKey", "requestedRunState", "requestedReactivePowerKvar",
  "requestedSocUpperPct", "requestedSocLowerPct", "emsHeartbeat",
  "maxChargeKw", "maxDischargeKw", "socPct", "sohPct", "actualPowerKw",
]);

const compact = (input) => Object.fromEntries(Object.entries(input).filter(([,value]) => value !== undefined));
const revisionAttributes = (section, revision) => ({
  gridexConfigurationSection: section,
  gridexConfigurationRevision: revision,
});

function bindingAsset(bindings, section, resourceType, resourceId) {
  const binding = bindings.find((item) => item.section === section && item.localResourceType === resourceType && item.localResourceId === resourceId);
  if (!binding) throw new ApiError(409, "openremote_binding_missing", `No OpenRemote binding exists for ${resourceType}:${resourceId}.`);
  return binding.openremoteAssetId;
}

function assertSafeAttributes(attributes) {
  for (const name of Object.keys(attributes)) {
    if (protectedAttributes.has(name)) throw new ApiError(500, "unsafe_configuration_projection", `Configuration projection attempted to write protected attribute ${name}.`);
  }
  return attributes;
}

/** Build an allow-listed projection. Payload-provided Asset IDs are never trusted. */
export function buildConfigurationProjection(event, context) {
  const { section, revision, configuration: config } = event;
  const siteAssetId = context.site.openremoteSiteAssetId;
  const strategyAssetId = context.site.openremoteStrategyAssetId;
  const operations = [];
  const add = (assetId, attributes) => {
    if (!assetId) throw new ApiError(409, "openremote_binding_missing", `The ${section} target Asset is not configured.`);
    operations.push({ assetId, attributes: assertSafeAttributes(compact({ ...attributes, ...revisionAttributes(section, revision) })) });
  };

  if (section === "site") add(siteAssetId, {
    gridexSiteCode: config.siteCode, countryCode: config.countryCode,
    timezone: config.timezone, marketCode: config.marketCode,
    location: Number.isFinite(config.latitude) && Number.isFinite(config.longitude)
      ? { lat: config.latitude, lon: config.longitude } : undefined,
  });

  if (section === "pv") for (const array of config.arrays || []) add(
    bindingAsset(context.bindings, section, "pv_array", array.id), {
      configurationEnabled: array.enabled,
      configurationOrientationProfile: array.orientationProfile,
      configurationMountingType: array.mountingType,
      configurationTrackingType: array.trackingType,
      configurationModuleLayout: array.moduleLayout,
      configurationDcKwp: array.dcKwp,
      configurationTiltDeg: array.tiltDeg,
      configurationAzimuthDeg: array.azimuthDeg,
      configurationPerformanceRatio: array.performanceRatio,
      configurationTemperatureCoefficientPctPerC: array.temperatureCoefficientPctPerC,
      configurationShadingLossPct: array.shadingLossPct,
    },
  );

  if (section === "battery_pcs") add(bindingAsset(context.bindings, section, "battery_system", config.id), {
    configurationSystemType: config.systemType,
    configurationCoupling: config.coupling,
    configurationUsableCapacityKwh: config.usableCapacityKwh,
    configurationRatedPcsPowerKw: config.ratedPcsPowerKw,
    configurationMinimumSocPct: config.minimumSocPct,
    configurationMaximumSocPct: config.maximumSocPct,
    configurationReserveSocPct: config.reserveSocPct,
    configurationGridChargePermitted: config.gridChargePermitted,
    configurationBatteryExportPermitted: config.batteryExportPermitted,
  });

  if (section === "metering_grid") add(siteAssetId, {
    configurationPccMeterId: config.pccMeterDeviceId,
    configurationSignConvention: config.signConvention,
    configurationMaximumImportKw: config.maximumImportKw,
    configurationMaximumExportKw: config.maximumExportKw,
    configurationSoftwareFuseMarginKw: config.softwareFuseMarginKw,
    configurationMeterUnavailableMode: config.meterUnavailableMode,
    configurationZeroExportToleranceKw: config.zeroExportToleranceKw,
  });

  if (section === "market_tariffs") add(siteAssetId, {
    configurationCurrency: config.currency,
    configurationDayAheadSource: config.dayAheadSource,
    configurationTariffRevision: revision,
    configurationTariffValidFrom: config.validFrom,
  });

  if (section === "forecast") add(strategyAssetId, {
    configurationPriceModels: config.priceModels,
    configurationWeatherProvider: config.weatherProvider,
    configurationPvModel: config.pvModel,
    configurationLoadModel: config.loadModel,
    configurationForecastHorizonHours: config.horizonHours,
    configurationForecastResolutionMinutes: config.resolutionMinutes,
    configurationMinimumForecastConfidencePct: config.minimumConfidencePct,
    configurationMaximumForecastAgeMinutes: config.maximumAgeMinutes,
  });

  if (section === "strategy") add(strategyAssetId, {
    configurationStrategyCode: config.code,
    configurationFallbackMode: config.fallbackMode,
    configurationControlIntervalSeconds: config.controlIntervalSeconds,
    configurationReoptimiseMinutes: config.reoptimiseMinutes,
    configurationLossProtection: config.lossProtection,
    configurationLowSolarReserveSocPct: config.lowSolarReserveSocPct,
  });

  if (section === "loads_ev") for (const item of [...(config.loads || []), ...(config.evse || [])]) add(
    bindingAsset(context.bindings, section, item.type === "evse" ? "evse" : "flexible_load", item.id), {
      configurationPriority: item.priority,
      configurationMinimumPowerKw: item.minimumPowerKw,
      configurationMaximumPowerKw: item.maximumPowerKw,
      configurationEnergyTargetKwh: item.energyTargetKwh,
      configurationDeadline: item.deadline,
      configurationInterruptionPolicy: item.interruptionPolicy,
    },
  );

  if (section === "edge_devices") add(siteAssetId, {
    configurationEdgeTopologyRevision: revision,
    configurationControllerModel: config.controller?.hardwareModel,
  });

  // Notification recipients, roles and approval policy are backend-only.
  if (section === "notifications_access") return [];
  if (operations.length === 0) throw new ApiError(400, "empty_configuration_projection", `No allow-listed projection exists for ${section}.`);
  return operations;
}
