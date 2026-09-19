import { readFileSync } from 'node:fs';
import { connect } from 'mqtt';
import { loadConfig } from './config.mjs';
import { createRepository } from './repository.mjs';
import { DeviceHeartbeats, parseHeartbeat } from './device-heartbeats.mjs';

const env = process.env;
const bindings = JSON.parse(env.GRIDEX_HEARTBEAT_BINDINGS || '[]');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const segment = /^[A-Za-z0-9_-]{1,64}$/;
if (!Array.isArray(bindings) || !bindings.length) throw new Error('Heartbeat bindings required');
const topics = new Map();
const devices = new Set();
for (const b of bindings) {
  b.prefix = env.GRIDEX_MQTT_TOPIC_PREFIX || 'gridex/v1';
  if (!/^[A-Za-z0-9_/-]+$/.test(b.prefix) || !segment.test(b.site) || !segment.test(b.gateway)
    || !uuid.test(b.siteId) || !uuid.test(b.gatewayId) || !b.nodes || typeof b.nodes !== 'object') throw new Error('Invalid binding');
  const base = `${b.prefix}/sites/${b.site}/edge/${b.gateway}`;
  if (devices.has(b.gatewayId) || topics.has(`${base}/health`)) throw new Error('Duplicate binding');
  devices.add(b.gatewayId);
  topics.set(`${base}/health`, b);
  for (const [slot,id] of Object.entries(b.nodes)) {
    if (!/^[1-9][0-9]{0,2}$/.test(slot) || !uuid.test(id) || devices.has(id)) throw new Error('Invalid node binding');
    devices.add(id);
    topics.set(`${base}/nodes/${slot}/telemetry`, b);
  }
}
if (!env.GRIDEX_MQTT_URL?.startsWith('mqtts://')) throw new Error('Private MQTT TLS required');
const repository = createRepository(loadConfig());
if (!repository.pool) throw new Error('Durable database required');
const store = new DeviceHeartbeats(repository.pool);
const client = connect(env.GRIDEX_MQTT_URL, {
  clientId: env.GRIDEX_HEARTBEAT_CLIENT_ID || 'gridex-heartbeat-reader', clean: true,
  ca: readFileSync(env.GRIDEX_MQTT_CA_FILE), cert: readFileSync(env.GRIDEX_MQTT_CLIENT_CERT_FILE),
  key: readFileSync(env.GRIDEX_MQTT_CLIENT_KEY_FILE), rejectUnauthorized: true,
  reconnectPeriod: 5000, connectTimeout: 10000,
});
client.on('connect', () => client.subscribe([...topics.keys()], { qos: 1 }, error => {
  console.log(error ? 'Heartbeat subscription failed' : 'Heartbeat subscription active');
}));
client.on('error', () => console.error('Heartbeat MQTT connection failed'));
// Bound database work; overload drops observations, never commands or recovery records.
let pending = 0;
client.on('message', async (topic, buffer, packet) => {
  if (!topics.has(topic) || pending >= 32) return;
  pending++;
  try { await store.accept(parseHeartbeat(topic, buffer, topics.get(topic), { retained: packet.retain })); }
  catch { console.error('Heartbeat rejected or persistence unavailable'); }
  finally { pending--; }
});
async function stop() { client.end(true); await repository.close(); }
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
