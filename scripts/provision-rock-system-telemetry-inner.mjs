import {createRepository} from './src/repository.mjs';
import {loadConfig} from './src/config.mjs';
import {randomBytes} from 'node:crypto';

let input=''; for await (const chunk of process.stdin) input += chunk;
const cfg=JSON.parse(input), env=process.env, base=`${env.OPENREMOTE_BASE_URL||'http://manager:8080'}/api/${env.OPENREMOTE_REALM||'gridex'}`;
async function token(){const r=await fetch(`${env.OIDC_TOKEN_ENDPOINT}`,{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:env.OPENREMOTE_SERVICE_CLIENT_ID,client_secret:env.OPENREMOTE_SERVICE_CLIENT_SECRET})});if(!r.ok)throw Error('service token unavailable');return (await r.json()).access_token;}
let serviceToken=await token();
async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{Authorization:`Bearer ${serviceToken}`,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();if(!r.ok)throw Error(`OpenRemote ${method} ${path} failed: ${r.status} ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
let bootstrapClientId, bootstrapResourceId, writerUserId;
if (cfg.adminPassword) {
  const kc='http://keycloak:8080/auth', master=await (async()=>{const r=await fetch(`${kc}/realms/master/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.adminPassword})});if(!r.ok)throw Error('master admin token unavailable');return (await r.json()).access_token;})();
  async function kreq(path,method='GET',body){const r=await fetch(`${kc}/admin/realms/gridex${path}`,{method,headers:{Authorization:`Bearer ${master}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(`Keycloak admin ${method} ${path} failed: ${r.status}`);const t=await r.text();return t?JSON.parse(t):null;}
  const openremoteClients=await kreq('/clients?clientId=openremote');
  if(openremoteClients.length!==1)throw Error('OpenRemote client not unique');
  const openremoteId=openremoteClients[0].id;
  const writerClients=await kreq('/clients?clientId='+encodeURIComponent(cfg.writerId||''));
  if(writerClients.length!==1||writerClients[0].clientId!==cfg.writerId)throw Error('Restricted history writer not unique');
  const writer=await kreq('/clients/'+writerClients[0].id+'/service-account-user');
  const writerRealmRoles=await kreq('/users/'+writer.id+'/role-mappings/realm');
  const writerClientRoles=await kreq('/users/'+writer.id+'/role-mappings/clients/'+openremoteId);
  if(!writerRealmRoles.some(r=>r.name==='restricted_user')||
     !['read:assets','write:attributes'].every(name=>writerClientRoles.some(r=>r.name===name))||
     writerClientRoles.some(r=>r.name==='write:assets'))throw Error('History writer does not have restricted attribute-writer permissions');
  writerUserId=writer.id;
  const roles=await kreq('/clients/'+openremoteId+'/roles');
  const clientId='gridex-telemetry-setup-'+randomBytes(6).toString('hex'), secret=randomBytes(32).toString('hex');
  await kreq('/clients','POST',{clientId,secret,enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:true,protocolMappers:[{name:'openremote-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',config:{'included.client.audience':'openremote','access.token.claim':'true'}}]});
  const client=(await kreq('/clients?clientId='+clientId))[0];bootstrapClientId=clientId;bootstrapResourceId=client.id;
  const user=await kreq('/clients/'+client.id+'/service-account-user');const selected=['read:assets','write:assets','read:admin'].map(n=>roles.find(r=>r.name===n));if(selected.some(x=>!x))throw Error('OpenRemote setup roles unavailable');
  await kreq('/users/'+user.id+'/role-mappings/clients/'+openremoteId,'POST',selected);
  const setup=await (await fetch(`${kc}/realms/gridex/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:secret})})).json();
  serviceToken=setup.access_token;
}
const all=await req('/asset/query','POST',{});
const gateway=all.find(a=>a.attributes?.gridexGatewayId?.value===cfg.gatewayId&&a.attributes?.gridexSiteId?.value===cfg.siteId&&a.attributes?.gatewayRole?.value==='controller');
if(!gateway)throw Error('OpenRemote ROCK Pi gateway asset not found');
const owner=cfg.ownerSubject;
if(!writerUserId)throw Error('Restricted history writer verification required');
const writerLinks=await req('/asset/user/link?realm='+encodeURIComponent(env.OPENREMOTE_REALM||'gridex')+'&userId='+encodeURIComponent(writerUserId));
const linkedToWriter=new Set(writerLinks.map(link=>link.id?.assetId));
const metrics=[
  ['cpuTemperatureC','ROCK Pi CPU temperature','Cel','cpu-temperature-celsius'],
  ['uptimeSeconds','ROCK Pi uptime','s','system-uptime-seconds'],
  ['load1','ROCK Pi load (1 minute)','load','system-load-1'],
  ['memoryAvailableBytes','ROCK Pi available memory','bytes','memory-available-bytes'],
  ['storageDataFreeBytes','ROCK Pi data free space','bytes','storage-data-free-bytes'],
  ['journalSizeBytes','ROCK Pi telemetry journal size','bytes','telemetry-journal-size-bytes'],
];
const assets=[];
for(const [metric,name,unit,kind] of metrics){
  let asset=all.find(a=>a.parentId===gateway.id&&(a.attributes?.gridexMetricId?.value===metric||(metric==='cpuTemperatureC'&&a.name==='ROCK Pi CPU temperature')));
  if(!asset){asset=await req('/asset','POST',{name,type:'ThingAsset',realm:env.OPENREMOTE_REALM||'gridex',parentId:gateway.id,attributes:{location:{type:'GEO_JSONPoint',value:null,meta:{}},notes:{type:'text',value:`ROCK Pi ${metric} telemetry history.`,meta:{}},gridexSiteId:{type:'text',value:cfg.siteId,meta:{}},gridexGatewayId:{type:'text',value:cfg.gatewayId,meta:{}},gridexMetricId:{type:'text',value:metric,meta:{readOnly:true}},measurementKind:{type:'text',value:kind,meta:{readOnly:true}},[metric]:{type:'number',value:null,meta:{storeDataPoints:true,accessRestrictedRead:true,accessRestrictedWrite:true,readOnly:true,unit}}}});}
  await req('/asset/user/link','POST',[{id:{realm:env.OPENREMOTE_REALM||'gridex',userId:owner,assetId:asset.id}}]);
  if(!linkedToWriter.has(asset.id)){
    await req('/asset/user/link','POST',[{id:{realm:env.OPENREMOTE_REALM||'gridex',userId:writerUserId,assetId:asset.id}}]);
    linkedToWriter.add(asset.id);
  }
  assets.push({metric,assetId:asset.id});
}
const verifiedLinks=await req('/asset/user/link?realm='+encodeURIComponent(env.OPENREMOTE_REALM||'gridex')+'&userId='+encodeURIComponent(writerUserId));
const verifiedIds=new Set(verifiedLinks.map(link=>link.id?.assetId));
if(assets.some(asset=>!verifiedIds.has(asset.assetId)))throw Error('History writer links not verified');
await req(`/asset/${encodeURIComponent(gateway.id)}`);
const topic=`${cfg.prefix||'gridex/v1'}/sites/${cfg.siteId}/edge/${cfg.gatewayId}/system/telemetry`;
console.log(JSON.stringify({bindings:assets.map(x=>({siteId:cfg.siteId,gatewayId:cfg.gatewayId,sourceGateway:cfg.gatewayId,assetId:x.assetId,topic,metric:x.metric})),assets}));
if (bootstrapResourceId) { const kcAdmin='http://keycloak:8080/auth/admin/realms/gridex'; const master=await (async()=>{const r=await fetch('http://keycloak:8080/auth/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.adminPassword})});return (await r.json()).access_token;})(); await fetch(`${kcAdmin}/clients/${bootstrapResourceId}`,{method:'DELETE',headers:{Authorization:`Bearer ${master}`}}); }
await createRepository(loadConfig()).close();
