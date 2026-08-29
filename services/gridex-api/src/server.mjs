import { createServer } from "node:http";

const port = Number(process.env.PORT || 8080);
const openRemoteBaseUrl = (process.env.OPENREMOTE_BASE_URL || "https://ems.gridex.tech").replace(/\/$/, "");
const realm = process.env.OPENREMOTE_REALM || "gridex";
const writesEnabled = process.env.GRIDEX_WRITES_ENABLED === "true";
const allowedOrigins = new Set((process.env.GRIDEX_ALLOWED_ORIGINS || "https://gridex.tech,https://app.gridex.tech")
  .split(",").map((value) => value.trim()).filter(Boolean));

let siteMap = {};
try {
  siteMap = JSON.parse(process.env.GRIDEX_SITE_MAP_JSON || "{}");
} catch {
  throw new Error("GRIDEX_SITE_MAP_JSON must be valid JSON");
}

function json(res, status, body, origin) {
  const payload = JSON.stringify(body);
  cors(res, origin);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

function cors(res, origin) {
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function bearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") && value.length > 20 ? value : undefined;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function orFetch(path, authorization, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", authorization);
  const response = await fetch(`${openRemoteBaseUrl}/api/${encodeURIComponent(realm)}${path}`, { ...init, headers });
  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    const error = new Error(`OpenRemote returned ${response.status}`);
    error.status = response.status;
    error.details = details;
    throw error;
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function value(asset, name, fallback = 0) {
  return asset?.attributes?.[name]?.value ?? fallback;
}

async function getSnapshot(site, authorization) {
  const [battery, control, strategy] = await Promise.all([
    orFetch(`/asset/${encodeURIComponent(site.batteryAssetId)}`, authorization),
    orFetch(`/asset/${encodeURIComponent(site.controlAssetId)}`, authorization),
    orFetch(`/asset/${encodeURIComponent(site.strategyAssetId)}`, authorization),
  ]);
  const limitsValid = Boolean(value(control, "limitsValid", false));
  const controlReady = Boolean(value(control, "controlReady", false));
  return {
    assetId: battery.id,
    siteId: site.id,
    siteName: site.name,
    timestamp: new Date().toISOString(),
    quality: controlReady && limitsValid ? "GOOD" : "STALE",
    battery: {
      socPct: Number(value(battery, "socPct")),
      sohPct: Number(value(battery, "sohPct")),
      maxChargeKw: Number(value(battery, "maxChargeKw")),
      maxDischargeKw: Number(value(battery, "maxDischargeKw")),
      limitsValid,
      controlReady,
    },
    power: {
      actualKw: Number(value(battery, "actualPowerKw")),
      requestedKw: Number(value(control, "requestedPowerKw")),
      appliedKw: Number(value(control, "appliedPowerKw")),
      dcKw: Number(value(battery, "dcPowerKw")),
      reactiveKvar: Number(value(battery, "reactivePowerKvar")),
    },
    strategy: {
      mode: value(strategy, "mode", "automatic"),
      targetSocPct: Number(value(strategy, "targetSocPct")),
    },
  };
}

async function writeAttribute(assetId, attributeName, attributeValue, authorization) {
  return orFetch(`/asset/${encodeURIComponent(assetId)}/attribute/${encodeURIComponent(attributeName)}`, authorization, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(attributeValue),
  });
}

function validatePowerCommand(command) {
  if (!Number.isInteger(command.sequence) || command.sequence < 0 || command.sequence > 65535) return "sequence must be uint16";
  if (!Number.isFinite(command.requestedPowerKw) || command.requestedPowerKw < -3276.8 || command.requestedPowerKw > 3276.7) return "requestedPowerKw is outside int16 x10 range";
  if (typeof command.enable !== "boolean") return "enable must be boolean";
  if (!["automatic", "schedule", "operator", "safe-mode"].includes(command.source)) return "source is invalid";
  return undefined;
}

const server = createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && !allowedOrigins.has(origin)) return json(res, 403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") { cors(res, origin); res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET" && url.pathname === "/health") {
    let openRemote = "offline";
    try {
      const response = await fetch(openRemoteBaseUrl, { method: "HEAD", signal: AbortSignal.timeout(3000) });
      openRemote = response.status < 500 ? "online" : "offline";
    } catch {}
    return json(res, openRemote === "online" ? 200 : 503, { status: "ready", openRemote, writesEnabled }, origin);
  }

  const authorization = bearer(req);
  if (!authorization) return json(res, 401, { error: "authentication_required" }, origin);

  if (req.method === "GET" && url.pathname === "/api/v1/sites") {
    const sites = Object.values(siteMap).map(({ id, name }) => ({ id, name }));
    return json(res, 200, { sites }, origin);
  }

  const snapshotMatch = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)\/snapshot$/);
  if (req.method === "GET" && snapshotMatch) {
    const site = siteMap[decodeURIComponent(snapshotMatch[1])];
    if (!site) return json(res, 404, { error: "site_not_configured" }, origin);
    try { return json(res, 200, await getSnapshot(site, authorization), origin); }
    catch (error) { return json(res, error.status || 502, { error: "openremote_error", details: error.message }, origin); }
  }

  const commandMatch = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)\/commands\/power$/);
  if (req.method === "POST" && commandMatch) {
    if (!writesEnabled) return json(res, 503, { error: "writes_locked_until_commissioning" }, origin);
    const site = siteMap[decodeURIComponent(commandMatch[1])];
    if (!site) return json(res, 404, { error: "site_not_configured" }, origin);
    try {
      const command = await readJson(req);
      const validation = validatePowerCommand(command);
      if (validation) return json(res, 400, { error: "invalid_command", details: validation }, origin);
      await writeAttribute(site.controlAssetId, "powerCommand", {
        ...command,
        timestamp: new Date().toISOString(),
        ttlSeconds: command.ttlSeconds || 15,
      }, authorization);
      return json(res, 202, { accepted: true, sequence: command.sequence }, origin);
    } catch (error) {
      return json(res, error.status || 502, { error: "command_not_accepted", details: error.message }, origin);
    }
  }

  return json(res, 404, { error: "not_found" }, origin);
});

server.listen(port, "0.0.0.0", () => console.log(`GridEx API listening on ${port}`));
