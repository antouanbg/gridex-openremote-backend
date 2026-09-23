const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ROCK_METRICS={
 cpuTemperatureC:{unit:'Cel',minimum:-40,maximum:150}, uptimeSeconds:{unit:'s',minimum:0,maximum:315576000},
 load1:{unit:'load',minimum:0,maximum:1024}, memoryAvailableBytes:{unit:'bytes',minimum:0,maximum:Number.MAX_SAFE_INTEGER},
 storageDataFreeBytes:{unit:'bytes',minimum:0,maximum:Number.MAX_SAFE_INTEGER}, journalSizeBytes:{unit:'bytes',minimum:0,maximum:Number.MAX_SAFE_INTEGER},
};
export function validateHistoryBindings(input){
 if(!Array.isArray(input)||!input.length)throw Error('History bindings required');
 const seen=new Set();
 for(const b of input){
  if(!uuid.test(b.siteId)||!uuid.test(b.gatewayId)||!/^[A-Za-z0-9]{22}$/.test(b.assetId)
   ||typeof b.topic!=='string'||/[+#\s]/.test(b.topic)||(!b.topic.endsWith('/health')&&!b.topic.endsWith('/system/telemetry'))
   ||!b.sourceGateway||!ROCK_METRICS[b.metric]||seen.has(`${b.topic}|${b.metric}`))throw Error('Invalid history binding');
  seen.add(`${b.topic}|${b.metric}`);
 }
 return input;
}
export function parseTemperature(topic,buffer,binding,{retained=false,now=Date.now()}={}){
 if(retained||topic!==binding.topic||buffer.length>32768)return null;
 let x;try{x=JSON.parse(buffer.toString())}catch{return null;}
 if(!x||x.schemaVersion!==1||x.gatewayId!==binding.sourceGateway)return null;
 const time=Date.parse(x.observedAt);
 if(!Number.isFinite(time)||time>now+5000||time<now-120000)return null;
 const value=x.cpuTemperatureC;
 if(typeof value!=='number'||!Number.isFinite(value)||value< -40||value>150)return null;
 return{siteId:binding.siteId,gatewayId:binding.gatewayId,assetId:binding.assetId,metric:binding.metric,observedAt:new Date(time).toISOString(),value};
}
export function parseSystemTelemetry(topic,buffer,bindings,{retained=false,now=Date.now()}={}){
 if(retained||buffer.length>32768)return [];
 let x;try{x=JSON.parse(buffer.toString())}catch{return []}
 if(!x||x.schemaVersion!==1||typeof x.gatewayId!=='string'||!Array.isArray(x.samples)||x.samples.length>32)return [];
 const time=Date.parse(x.observedAt); if(!Number.isFinite(time)||time>now+5000||time<now-120000)return [];
 return bindings.flatMap(b=>x.samples.filter(s=>s?.sensorId===b.metric).map(s=>{
  const rule=ROCK_METRICS[b.metric], value=s.value;
  const sampleTime=Date.parse(s.observedAt||x.observedAt);
  if(x.gatewayId!==b.sourceGateway||!Number.isFinite(sampleTime)||sampleTime>now+5000||sampleTime<now-120000)return null;
  if(s.unit!==undefined&&s.unit!==rule.unit)return null;
  if(typeof value!=='number'||!Number.isFinite(value)||value<rule.minimum||value>rule.maximum)return null;
  return {siteId:b.siteId,gatewayId:b.gatewayId,assetId:b.assetId,metric:b.metric,observedAt:new Date(sampleTime).toISOString(),value};
 }).filter(Boolean));
}
export async function enqueueMeasurement(pool,sample){
 if(!sample)return false;
 const r=await pool.query(`INSERT INTO history_outbox(gateway_id,site_id,asset_id,metric,observed_at,value)
 SELECT g.id,g.site_id,$3,$4,$5,$6 FROM gateways g JOIN sites s ON s.id=g.site_id
 WHERE g.id=$1 AND g.site_id=$2 AND g.role='controller' AND s.deleted_at IS NULL
 ON CONFLICT(asset_id,metric,observed_at) DO NOTHING`,[sample.gatewayId,sample.siteId,sample.assetId,sample.metric,sample.observedAt,sample.value]);
 return r.rowCount===1;
}
