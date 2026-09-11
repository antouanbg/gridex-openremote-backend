import test from "node:test";
import assert from "node:assert/strict";
import { edgeHealthSnapshot, parseHealthTopic, validateEdgeHealth } from "../src/edge-health.mjs";

test("accepts a VPN-only site health topic and validated health payload", () => {
  assert.deepEqual(parseHealthTopic("gridex/v1/sites/SITE-001/edge/rockpi-01/health"), { siteCode: "SITE-001", gatewayId: "rockpi-01" });
  const health = validateEdgeHealth({ schemaVersion: 1, gatewayId: "rockpi-01", observedAt: "2026-01-01T00:00:00.000Z", state: "ready", pcsHeartbeatOk: true, controlReady: true, safeMode: false, northboundReady: true, nodeOnlineCount: 2, nodeTotal: 2 }, new Date("2026-01-01T00:00:01.000Z"));
  assert.equal(health.gatewayId, "rockpi-01");
});

test("marks stale and safe health deterministically for a snapshot", () => {
  const row = { gatewayId: "rockpi-01", receivedAt: "2026-01-01T00:00:00.000Z", observedAt: "2026-01-01T00:00:00.000Z", state: "ready", safeMode: false, pcsHeartbeatOk: true, controlReady: true, northboundReady: true, nodeOnlineCount: 1, nodeTotal: 1 };
  assert.equal(edgeHealthSnapshot(row, new Date("2026-01-01T00:00:31.000Z"), 30, 90).status, "degraded");
  assert.equal(edgeHealthSnapshot({ ...row, safeMode: true }, new Date("2026-01-01T00:00:05.000Z"), 30, 90).status, "safe_mode");
});
