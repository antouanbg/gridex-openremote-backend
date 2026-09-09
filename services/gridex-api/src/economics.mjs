import { ApiError } from "./errors.mjs";

const finite = (value, name, minimum = -Infinity) => {
  if (!Number.isFinite(value) || value < minimum) throw new ApiError(400, "invalid_economics", `${name} is invalid.`);
  return value;
};

export function validateLossProtection(input = {}) {
  const policy = input && typeof input === "object" ? input : {};
  const mode = policy.mode || "full_cost";
  if (!['cash_cost', 'full_cost'].includes(mode)) throw new ApiError(400, "invalid_economics", "lossProtection.mode must be cash_cost or full_cost.");
  return {
    enabled: policy.enabled !== false,
    mode,
    minimumMarginPerMwh: finite(policy.minimumMarginPerMwh ?? 0, "minimumMarginPerMwh"),
    blockNegativePriceExport: policy.blockNegativePriceExport !== false,
    includeImbalanceRisk: policy.includeImbalanceRisk !== false,
    includeBatteryDegradation: policy.includeBatteryDegradation !== false,
    includeAssetDepreciation: policy.includeAssetDepreciation !== false,
  };
}

export function calculateSaleEconomics(input) {
  const path = input.path;
  if (!['pv_direct', 'battery_discharge'].includes(path)) throw new ApiError(400, "invalid_economics", "path must be pv_direct or battery_discharge.");
  const policy = validateLossProtection(input.policy);
  const components = {
    marketSalePricePerMwh: finite(input.marketSalePricePerMwh, "marketSalePricePerMwh"),
    traderFeePerMwh: finite(input.traderFeePerMwh ?? 0, "traderFeePerMwh", 0),
    exchangeFeePerMwh: finite(input.exchangeFeePerMwh ?? 0, "exchangeFeePerMwh", 0),
    exportNetworkFeePerMwh: finite(input.exportNetworkFeePerMwh ?? 0, "exportNetworkFeePerMwh", 0),
    imbalanceRiskPerMwh: policy.includeImbalanceRisk ? finite(input.imbalanceRiskPerMwh ?? 0, "imbalanceRiskPerMwh", 0) : 0,
    pvVariableCostPerMwh: finite(input.pvVariableCostPerMwh ?? 0, "pvVariableCostPerMwh", 0),
    pvDepreciationPerMwh: policy.mode === "full_cost" && policy.includeAssetDepreciation ? finite(input.pvDepreciationPerMwh ?? 0, "pvDepreciationPerMwh", 0) : 0,
    sourceEnergyCostPerMwh: 0,
    batteryConversionLossPerMwh: 0,
    batteryDegradationPerMwh: 0,
    batteryDepreciationPerMwh: 0,
  };
  if (path === "battery_discharge") {
    const efficiency = finite(input.batteryRoundTripEfficiency ?? 0.9, "batteryRoundTripEfficiency", 0.01);
    if (efficiency > 1) throw new ApiError(400, "invalid_economics", "batteryRoundTripEfficiency cannot exceed 1.");
    const sourceEnergyCost = finite(input.sourceEnergyCostPerMwh ?? 0, "sourceEnergyCostPerMwh");
    components.sourceEnergyCostPerMwh = sourceEnergyCost;
    components.batteryConversionLossPerMwh = Math.max(0, sourceEnergyCost * ((1 / efficiency) - 1));
    if (policy.mode === "full_cost" && policy.includeBatteryDegradation) {
      components.batteryDegradationPerMwh = finite(input.batteryDegradationPerMwh ?? 0, "batteryDegradationPerMwh", 0);
    }
    if (policy.mode === "full_cost" && policy.includeAssetDepreciation) {
      components.batteryDepreciationPerMwh = finite(input.batteryDepreciationPerMwh ?? 0, "batteryDepreciationPerMwh", 0);
    }
  }
  const costKeys = Object.keys(components).filter((key) => key !== "marketSalePricePerMwh");
  const totalCostPerMwh = costKeys.reduce((sum, key) => sum + components[key], 0);
  const minimumSalePricePerMwh = totalCostPerMwh + policy.minimumMarginPerMwh;
  const netMarginPerMwh = components.marketSalePricePerMwh - totalCostPerMwh;
  const blockedByNegativePrice = policy.blockNegativePriceExport && components.marketSalePricePerMwh < 0;
  return {
    path,
    policy,
    components,
    totalCostPerMwh,
    minimumSalePricePerMwh,
    netMarginPerMwh,
    saleAllowed: !policy.enabled || (!blockedByNegativePrice && components.marketSalePricePerMwh >= minimumSalePricePerMwh),
    reasonCode: !policy.enabled ? "loss_protection_disabled" : blockedByNegativePrice ? "negative_price_block" : components.marketSalePricePerMwh < minimumSalePricePerMwh ? "below_cost_floor" : "profitable_sale",
  };
}

export function calculateBatteryCycleProjection(input) {
  const usableCapacityKwh = finite(input.usableCapacityKwh, "usableCapacityKwh", 0.001);
  const gridChargeKwh = finite(input.gridChargeKwh ?? 0, "gridChargeKwh", 0);
  const pvChargeKwh = finite(input.pvChargeKwh ?? 0, "pvChargeKwh", 0);
  const dischargeKwh = finite(input.dischargeKwh ?? 0, "dischargeKwh", 0);
  return {
    horizonHours: input.horizonHours ?? 24,
    gridChargeKwh,
    pvChargeKwh,
    dischargeKwh,
    gridChargeEquivalentCycles: gridChargeKwh / usableCapacityKwh,
    pvChargeEquivalentCycles: pvChargeKwh / usableCapacityKwh,
    equivalentFullCycles: (gridChargeKwh + pvChargeKwh + dischargeKwh) / (2 * usableCapacityKwh),
  };
}
