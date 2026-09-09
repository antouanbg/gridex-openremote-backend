import { ApiError } from "./errors.mjs";
import { validateLossProtection } from "./economics.mjs";
import { validateForecastModelSelection } from "./forecast-models.mjs";

export const STRATEGY_CODES = Object.freeze([
  "intelligent_hybrid", "price_arbitrage", "self_consumption", "zero_export",
  "peak_shaving", "schedule_following", "backup_reserve", "manual",
]);

export function validateStrategyConfiguration(input) {
  if (!input || typeof input !== "object") throw new ApiError(400, "invalid_strategy", "A strategy configuration is required.");
  const code = input.code || input.strategyCode;
  if (!STRATEGY_CODES.includes(code)) throw new ApiError(400, "invalid_strategy", "Unsupported strategy code.");
  const numberOrNull = (value, field, minimum, maximum) => {
    if (value === undefined || value === null) return null;
    if (!Number.isFinite(value) || value < minimum || value > maximum) throw new ApiError(400, "invalid_strategy", `${field} is outside its allowed range.`);
    return value;
  };
  const battery = input.battery && typeof input.battery === "object" ? input.battery : {};
  const forecast = input.forecast && typeof input.forecast === "object" ? input.forecast : {};
  const forecastModel = validateForecastModelSelection(forecast);
  const minSocPct = numberOrNull(input.minSocPct ?? battery.minimumSocPct, "battery.minimumSocPct", 0, 100);
  const maxSocPct = numberOrNull(input.maxSocPct ?? battery.maximumSocPct, "battery.maximumSocPct", 0, 100);
  const reserveSocPct = numberOrNull(input.reserveSocPct ?? battery.emergencyReserveSocPct, "battery.emergencyReserveSocPct", 0, 100);
  if (minSocPct !== null && maxSocPct !== null && minSocPct >= maxSocPct) {
    throw new ApiError(400, "invalid_strategy", "minSocPct must be lower than maxSocPct.");
  }
  if (reserveSocPct !== null && ((minSocPct !== null && reserveSocPct < minSocPct) || (maxSocPct !== null && reserveSocPct > maxSocPct))) {
    throw new ApiError(400, "invalid_strategy", "reserveSocPct must be inside the configured SOC range.");
  }
  const horizon = input.forecastHorizonHours ?? forecast.horizonHours ?? 72;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 168) throw new ApiError(400, "invalid_strategy", "forecast.horizonHours must be between 1 and 168.");
  const output = structuredClone(input);
  output.schemaVersion ||= "1.0";
  output.code = code;
  output.enabled = input.enabled !== false;
  output.economics ||= {};
  output.economics.lossProtection = validateLossProtection(output.economics.lossProtection);
  output.economics.trackChargeOrigin = output.economics.trackChargeOrigin !== false;
  output.economics.priceForecastSources = Array.isArray(output.economics.priceForecastSources)
    ? output.economics.priceForecastSources.slice(0, 2)
    : [];
  if (["intelligent_hybrid", "price_arbitrage"].includes(code)) {
    if (output.economics.priceForecastSources.length !== 2 || output.economics.priceForecastSources.some((item) => !item || typeof item.source !== "string" || !item.source.trim())) {
      throw new ApiError(400, "invalid_strategy", "Two named price forecast sources are required for price-driven strategies.");
    }
  }
  output.economics.cycleForecastHorizonHours = 24;
  output.forecast ||= {};
  output.forecast.modelKey = forecastModel.key;
  delete output.strategyCode;
  return output;
}
