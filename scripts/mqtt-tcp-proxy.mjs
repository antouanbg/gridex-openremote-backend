// Byte-transparent LAN relay. TLS/mTLS and topic ACLs remain at Mosquitto.
import net from 'node:net';
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { pathToFileURL } from 'node:url';

export function configuration(env) {
  const host = env.GRIDEX_MQTT_PROXY_BIND;
  const allowed = (env.GRIDEX_MQTT_PROXY_ALLOWED_IPS || '').split(',').map(x => x.trim());
  const privateV4 = ip => net.isIPv4(ip) && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
  if (!privateV4(host) || !allowed.length || !allowed.every(privateV4)) throw new Error('Explicit private IPv4 bind and source allowlist required');
  return {host, port: 8883, allowed: new Set(allowed), upstreamHost: '127.0.0.1', upstreamPort: 8883,
    maxConnections: 16, idleMs: 120000, connectMs: 5000};
}

export function createProxy(config) {
  const sessions = new Set();
  const server = net.createServer(client => {
    if (!config.allowed.has(client.remoteAddress) || sessions.size >= config.maxConnections) {
      client.destroy(); return;
    }
    client.pause();
    const upstream = net.createConnection({host: config.upstreamHost, port: config.upstreamPort});
    const session = {client, upstream};
    sessions.add(session);
    const timer = setTimeout(() => close(), config.connectMs);
    function close() {
      clearTimeout(timer);
      client.destroy(); upstream.destroy(); sessions.delete(session);
    }
    for (const socket of [client, upstream]) {
      socket.setTimeout(config.idleMs, close);
      socket.on('error', close);
      socket.on('close', close);
    }
    upstream.once('connect', () => {
      clearTimeout(timer);
      client.pipe(upstream); upstream.pipe(client); client.resume();
    });
  });
  server.stop = () => {
    for (const {client, upstream} of sessions) {client.destroy(); upstream.destroy();}
    return new Promise(resolve => server.close(resolve));
  };
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file || (fs.statSync(file).mode & 0o077)) throw new Error('Private backend env must be mode 0600');
  const config = configuration(parseEnv(fs.readFileSync(file, 'utf8')));
  const server = createProxy(config);
  server.on('error', error => {console.error('MQTT relay failed:', error.code); process.exitCode = 1;});
  server.listen(config.port, config.host, () => console.log('MQTT LAN relay listening; TLS passthrough; source allowlist enforced'));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.stop());
}
