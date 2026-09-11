import { ApiError } from "./errors.mjs";

const STATES = new Set(["starting", "ready", "degraded", "safe_mode", "offline"]);
const identifier = (value, label) => {
  if (typeof value !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(value)) {
    throw new ApiError(400, "invalid_edge_health", `${label} is invalid.`);
  }
  return value;
};
const boolean = (value, label) => {
  if (typeof value !== "boolean") throw new ApiError(400, "invalid_edge_health", `${label} must be boolean.`);
  return value;
};
const count = (value, label) => {
  if (!Number.isInteger(value) || value < 0 || value > 10000) throw new ApiError(400, "invalid_edge_health", `${label} must be a non-negative integer.`);
  return value;
};

export function parseHealthTopic(topic, prefix = "gridex/v1") {
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${escaped}/sites/([A-Za-z0-9._:-]{1,128})/edge/([A-Za-z0-9._:-]{1,128})/health$`).exec(topic);
  if (!match) throw new ApiError(400, "invalid_edge_health_topic", "The MQTT health topic is not allowed.");
  return { siteCode: match[1], gatewayId: match[2] };
}

export function validateEdgeHealth(input, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new ApiError(400, "invalid_edge_health", "Health payload must be an object.");
  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > now.getTime() + 60_000) {
    throw new ApiError(400, "invalid_edge_health", "observedAt must be a valid non-future timestamp.");
  }
  const state = String(input.state || "");
  if (!STATES.has(state)) throw new ApiError(400, "invalid_edge_health", "state is invalid.");
  const nodeOnlineCount = count(input.nodeOnlineCount, "nodeOnlineCount");
  const nodeTotal = count(input.nodeTotal, "nodeTotal");
  if (nodeOnlineCount > nodeTotal) throw new ApiError(400, "invalid_edge_health", "nodeOnlineCount cannot exceed nodeTotal.");
  return {
    schemaVersion: Number(input.schemaVersion || 1),
    gatewayId: identifier(input.gatewayId, "gatewayId"), observedAt: observedAt.toISOString(), state,
    pcsHeartbeatOk: boolean(input.pcsHeartbeatOk, "pcsHeartbeatOk"), controlReady: boolean(input.controlReady, "controlReady"),
    safeMode: boolean(input.safeMode, "safeMode"), northboundReady: boolean(input.northboundReady, "northboundReady"),
    nodeOnlineCount, nodeTotal,
  };
}

export function edgeHealthSnapshot(row, now = new Date(), staleAfterSeconds = 30, offlineAfterSeconds = 90) {
  if (!row) return { status: "unknown", observedAt: null, gatewayId: null };
  const received = new Date(row.receivedAt || row.received_at).getTime();
  const ageSeconds = Math.max(0, Math.floor((now.getTime() - received) / 1000));
  const freshness = ageSeconds > offlineAfterSeconds ? "offline" : ageSeconds > staleAfterSeconds ? "degraded" : "online";
  const status = freshness === "online" && row.safeMode ? "safe_mode" : freshness;
  return {
    gatewayId: row.gatewayId || row.gateway_id, status, observedAt: row.observedAt || row.observed_at,
    receivedAt: row.receivedAt || row.received_at, ageSeconds, state: row.state,
    pcsHeartbeatOk: row.pcsHeartbeatOk ?? row.pcs_heartbeat_ok, controlReady: row.controlReady ?? row.control_ready,
    safeMode: row.safeMode ?? row.safe_mode, northboundReady: row.northboundReady ?? row.northbound_ready,
    nodeOnlineCount: row.nodeOnlineCount ?? row.node_online_count, nodeTotal: row.nodeTotal ?? row.node_total,
  };
}
