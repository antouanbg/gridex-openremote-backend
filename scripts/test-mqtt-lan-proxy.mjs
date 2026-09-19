// Synthetic transport acceptance only; never publishes physical device health.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import {parseEnv} from 'node:util';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../services/gridex-api/package.json',import.meta.url));
const mqtt=require('mqtt');
const runtime=path.join(os.homedir(),'GrideX-runtime');
const env=parseEnv(fs.readFileSync(path.join(runtime,'backend/.env'),'utf8'));
const host=env.GRIDEX_MQTT_PROXY_BIND;
const root=path.join(runtime,'mqtt');
const ca=fs.readFileSync(path.join(root,'server/ca.crt'));
const credentials=identity=>identity?{
  cert:fs.readFileSync(path.join(root,'clients',identity,'client.crt')),
  key:fs.readFileSync(path.join(root,'clients',identity,'client.key'))}:{};
const clients=[];
async function connect(identity) {
  const client=await mqtt.connectAsync(`mqtts://${host}:8883`,{ca,...credentials(identity),
    protocolVersion:5,reconnectPeriod:0,connectTimeout:4000,clientId:'proxy-test-'+randomUUID(),rejectUnauthorized:true});
  clients.push(client); return client;
}
try {
  try {await connect(null); throw new Error('Missing certificate was accepted');}
  catch(error) {if(error.message==='Missing certificate was accepted')throw error;}
  console.log('PASS no client certificate rejected');
  await new Promise((resolve,reject)=>{
    const socket=tls.connect({host,port:8883,ca,...credentials('lab-a'),servername:'wrong.invalid',rejectUnauthorized:true});
    socket.setTimeout(4000,()=>{socket.destroy();reject(new Error('Hostname test timeout'));});
    socket.once('secureConnect',()=>{socket.destroy();reject(new Error('Wrong hostname accepted'));});
    socket.once('error',error=>error.code==='ERR_TLS_CERT_ALTNAME_INVALID'?resolve():reject(error));
  });
  console.log('PASS wrong server hostname rejected');
  const reader=await connect('backend-reader'), writer=await connect('lab-a');
  const topic='gridex/v1/sites/lab-a/edge/gateway-a/nodes/proxy-test/telemetry';
  const marker='synthetic-proxy-'+randomUUID();
  await reader.subscribeAsync(topic,{qos:1});
  const received=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('No synthetic message received')),4000);
    reader.on('message',(t,p)=>{if(t===topic&&p.toString()===marker){clearTimeout(timer);resolve();}});
  });
  await writer.publishAsync(topic,marker,{qos:1,retain:false}); await received;
  console.log('PASS verified LAN TLS and own-topic delivery');
  for(const [client,target] of [[writer,'gridex/v1/sites/lab-b/edge/gateway-b/health'],[reader,topic]]) {
    let denied=false;
    try {await client.publishAsync(target,marker,{qos:1,retain:false});}
    catch(error) {denied=error.code===135;}
    if(!denied)throw new Error('ACL rejection not proven');
  }
  console.log('PASS cross-Site publish and reader writes rejected');
} finally {await Promise.all(clients.map(c=>c.endAsync(true)));}
