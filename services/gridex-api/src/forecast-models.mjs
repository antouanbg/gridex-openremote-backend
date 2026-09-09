import { ApiError } from "./errors.mjs";

export const FORECAST_MODELS = Object.freeze([
  { key: "lightgbm_v1", name: "LightGBM 15-minute ensemble", kind: "forecast", status: "production-candidate", description: "PV, load and price point forecasts from site history, calendar and weather features." },
  { key: "anguelov_ibex_milp_v1", name: "Anguelov IBEX MILP dispatch", kind: "optimisation", status: "research-profile", description: "GrideX adaptation of the published industrial PV-BESS IBEX day-ahead MILP formulation; it consumes forecasts and produces a 96-step schedule." },
]);

export function validateForecastModelSelection(value) {
  const modelKey = value?.modelKey || value?.optimisationModelKey || "lightgbm_v1";
  const selected = FORECAST_MODELS.find((model) => model.key === modelKey);
  if (!selected) throw new ApiError(400, "invalid_forecast_model", "Unsupported forecast or optimisation model.");
  return selected;
}
