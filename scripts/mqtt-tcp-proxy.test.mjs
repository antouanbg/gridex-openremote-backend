import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {once} from 'node:events';
import {configuration, createProxy} from './mqtt-tcp-proxy.mjs';

test('fails closed for wildcard/public/missing sources', () => {
  for (const env of [{}, {GRIDEX_MQTT_PROXY_BIND:'0.0.0.0',GRIDEX_MQTT_PROXY_ALLOWED_IPS:'10.0.0.2'},
    {GRIDEX_MQTT_PROXY_BIND:'10.0.0.1',GRIDEX_MQTT_PROXY_ALLOWED_IPS:'*'}]) assert.throws(() => configuration(env));
  assert.equal(configuration({GRIDEX_MQTT_PROXY_BIND:'10.0.0.1',GRIDEX_MQTT_PROXY_ALLOWED_IPS:'10.0.0.2'}).port,8883);
});

async function fixture(t, allowed, options={}) {
  const upstream=net.createServer(s=>s.pipe(s));
  upstream.listen(0,'127.0.0.1'); await once(upstream,'listening');
  const relay=createProxy({allowed:new Set(allowed),upstreamHost:'127.0.0.1',upstreamPort:upstream.address().port,
    maxConnections:2,idleMs:1000,connectMs:200,...options});
  relay.listen(0,'127.0.0.1'); await once(relay,'listening');
  t.after(async()=>{await relay.stop(); await new Promise(r=>upstream.close(r));});
  return ()=>net.createConnection({host:'127.0.0.1',port:relay.address().port});
}
test('forwards bytes unchanged in both directions',async t=>{
  const dial=await fixture(t,['127.0.0.1']); const socket=dial();
  await once(socket,'connect'); const bytes=Buffer.from([0,255,22,3,3,0,5]);
  const reply=once(socket,'data'); socket.write(bytes); assert.deepEqual((await reply)[0],bytes); socket.destroy();
});
test('rejects unlisted source',async t=>{
  const dial=await fixture(t,['10.0.0.2']); const socket=dial(); await once(socket,'close');
});
test('closes idle connections',async t=>{
  const dial=await fixture(t,['127.0.0.1'],{idleMs:40}); const socket=dial(); await once(socket,'close');
});
test('bounds concurrent sessions',async t=>{
  const dial=await fixture(t,['127.0.0.1'],{maxConnections:1});
  const first=dial(); await once(first,'connect');
  first.write('ready'); await once(first,'data');
  const second=dial(); await once(second,'close'); first.destroy();
});
test('upstream refusal closes the downstream socket',async t=>{
  const unused=net.createServer(); unused.listen(0,'127.0.0.1'); await once(unused,'listening');
  const port=unused.address().port; await new Promise(r=>unused.close(r));
  const dial=await fixture(t,['127.0.0.1'],{upstreamPort:port});
  const socket=dial(); await once(socket,'close');
});
