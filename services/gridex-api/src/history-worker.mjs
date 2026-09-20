import {readFileSync} from 'node:fs';
import {connect} from 'mqtt';
import {loadConfig} from './config.mjs';
import {createRepository} from './repository.mjs';
import {OpenRemoteClient} from './openremote-client.mjs';
import {validateHistoryBindings,parseTemperature,enqueueMeasurement} from './history-ingest.mjs';
const env=process.env,bindings=validateHistoryBindings(JSON.parse(env.GRIDEX_HISTORY_BINDINGS||'[]'));
const topics=new Map(bindings.map(b=>[b.topic,b]));
if(!env.GRIDEX_MQTT_URL?.startsWith('mqtts://'))throw Error('MQTT TLS required');
const config=loadConfig(),repo=createRepository(config),remote=new OpenRemoteClient(config);
await repo.pool.query('SELECT 1 FROM history_outbox LIMIT 0');
const client=connect(env.GRIDEX_MQTT_URL,{clientId:'gridex-history-reader',clean:true,
 ca:readFileSync(env.GRIDEX_MQTT_CA_FILE),cert:readFileSync(env.GRIDEX_MQTT_CLIENT_CERT_FILE),key:readFileSync(env.GRIDEX_MQTT_CLIENT_KEY_FILE),
 rejectUnauthorized:true,reconnectPeriod:5000,connectTimeout:10000});
client.on('connect',()=>client.subscribe([...topics.keys()],{qos:1},error=>console.log(error?'History subscription failed':'History subscription active')));
client.on('error',()=>console.error('History MQTT unavailable'));
// Deliberately reject retained health snapshots; never replay them as new measurements.
let pending=0;
client.on('message',async(topic,buffer,packet)=>{
 const b=topics.get(topic);if(!b)return;
 if(pending>=32){console.error('History ingestion overloaded; observation not queued');return;}
 pending++;
 try{await enqueueMeasurement(repo.pool,parseTemperature(topic,buffer,b,{retained:packet.retain}));}
 catch{console.error('History persistence unavailable; observation not queued');}
 finally{pending--;}
});
let running=false;
async function flush(){
 if(running)return;running=true;
 try{
  const{rows}=await repo.pool.query('SELECT * FROM history_outbox WHERE submitted_at IS NULL ORDER BY observed_at LIMIT 32');
  for(const row of rows){
   // Revalidate current configured asset/Site scope on retry as well as intake.
   if(!bindings.some(b=>b.assetId===row.asset_id&&b.siteId===row.site_id&&b.gatewayId===row.gateway_id&&b.metric===row.metric))continue;
   const keys=[row.asset_id,row.metric,row.observed_at];
   await repo.pool.query('UPDATE history_outbox SET attempts=attempts+1 WHERE asset_id=$1 AND metric=$2 AND observed_at=$3',keys);
   const result=await remote.request(`/asset/${encodeURIComponent(row.asset_id)}/attribute/${encodeURIComponent(row.metric)}/${new Date(row.observed_at).getTime()}`,{token:await remote.getServiceToken(),method:'PUT',body:row.value});
   if(result?.failure)throw Error('Attribute rejected');
   await repo.pool.query('UPDATE history_outbox SET submitted_at=now() WHERE asset_id=$1 AND metric=$2 AND observed_at=$3',keys);
  }
 }catch{console.error('History delivery pending retry');}
 finally{running=false;}
}
const timer=setInterval(flush,5000);await flush();
async function stop(){clearInterval(timer);client.end(true);while(running||pending)await new Promise(r=>setTimeout(r,50));await repo.close();}
process.once('SIGTERM',()=>stop().then(()=>process.exit(0)));
process.once('SIGINT',()=>stop().then(()=>process.exit(0)));
