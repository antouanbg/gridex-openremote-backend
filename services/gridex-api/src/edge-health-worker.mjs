import { connect } from "mqtt";
import { loadConfig, validateProductionConfig } from "./config.mjs";
import { OpenRemoteClient } from "./openremote-client.mjs";
import { createRepository } from "./repository.mjs";
import { parseHealthTopic, validateEdgeHealth } from "./edge-health.mjs";

const config = loadConfig();
validateProductionConfig(config);
if (!config.mqttUrl) throw new Error("GRIDEX_MQTT_URL is required for the edge-health worker.");
const repository = createRepository(config);
if (config.autoMigrate) await repository.migrate();
const openRemote = new OpenRemoteClient(config);
const client = connect(config.mqttUrl, { clientId: config.mqttClientId, username: config.mqttUsername || undefined, password: config.mqttPassword || undefined, reconnectPeriod: 5000, connectTimeout: 10000 });

client.on("connect", () => client.subscribe(`${config.mqttTopicPrefix}/sites/+/edge/+/health`, { qos: 1 }, (error) => {
  if (error) console.error("Edge health MQTT subscription failed", error.message);
  else console.log("Edge health MQTT subscription active");
}));
client.on("message", async (topic, buffer) => {
  try {
    const route = parseHealthTopic(topic, config.mqttTopicPrefix);
    const health = validateEdgeHealth(JSON.parse(buffer.toString("utf8")));
    if (health.gatewayId !== route.gatewayId) throw new Error("gatewayId does not match MQTT topic");
    const site = await repository.getSiteByCode(route.siteCode);
    const saved = await repository.upsertEdgeHealth(site.id, health);
    if (site.openremoteSiteAssetId) {
      await Promise.all([
        openRemote.writeManagedAttribute(site.openremoteSiteAssetId, "edgeGatewayStatus", saved.state),
        openRemote.writeManagedAttribute(site.openremoteSiteAssetId, "edgeGatewayObservedAt", saved.observedAt),
        openRemote.writeManagedAttribute(site.openremoteSiteAssetId, "edgeGatewayControlReady", saved.controlReady),
      ]);
    }
  } catch (error) { console.error("Rejected edge health message", { topic, error: error.message }); }
});
async function shutdown() { client.end(true); await repository.close(); }
process.on("SIGTERM", shutdown); process.on("SIGINT", shutdown);
