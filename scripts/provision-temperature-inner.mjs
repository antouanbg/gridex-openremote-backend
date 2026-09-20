// Execute only inside API container; private JSON input/output. No device writes.
import {randomBytes} from 'node:crypto';
import {createRepository} from './src/repository.mjs';
import {loadConfig} from './src/config.mjs';
let text='';for await(const c of process.stdin)text+=c;
const cfg=JSON.parse(text),kc='http://keycloak:8080/auth',or='http://manager:8080/api/gridex';
const repo=createRepository(loadConfig());
async function req(url,token,method='GET',body){
 const r=await fetch(url,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Provisioning HTTP '+r.status);
 const t=await r.text();return t?JSON.parse(t):null;
}
async function token(realm,body){const r=await fetch(kc+'/realms/'+realm+'/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams(body),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('Token unavailable');return(await r.json()).access_token;}
const admin=await token('master',{grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password});
const base=kc+'/admin/realms/gridex';
const users=await req(base+'/users?exact=true&email='+encodeURIComponent(cfg.email),admin);
if(users.length!==1)throw Error('Exactly one owner required');
const binding=cfg.bindings[0];if(cfg.bindings.length!==1)throw Error('Pilot requires one explicit binding');
const rows=await repo.pool.query(`SELECT g.id,g.site_id,s.openremote_site_asset_id FROM gateways g JOIN sites s ON s.id=g.site_id
 JOIN organisation_memberships m ON m.organisation_id=s.organisation_id
 WHERE g.id=$1 AND g.site_id=$2 AND g.role='controller' AND m.subject=$3 AND m.role='administrator'
 AND (m.all_sites OR EXISTS(SELECT 1 FROM membership_site_grants x WHERE x.subject=m.subject AND x.site_id=s.id AND x.organisation_id=m.organisation_id))`,[binding.gatewayId,binding.siteId,users[0].id]);
if(rows.rows.length!==1)throw Error('Owner/site/controller binding not confirmed');
const orClients=await req(base+'/clients?clientId=openremote',admin);if(orClients.length!==1)throw Error('OpenRemote client missing');
const roles=await req(base+'/clients/'+orClients[0].id+'/roles',admin);
async function createClient(clientId,roleNames){
 const secret=randomBytes(32).toString('hex');
 if((await req(base+'/clients?clientId='+clientId,admin)).length)throw Error('Client already exists; inspect before retry');
 await req(base+'/clients',admin,'POST',{clientId,secret,enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:true});
 const [client]=await req(base+'/clients?clientId='+clientId,admin);
 const user=await req(base+'/clients/'+client.id+'/service-account-user',admin);
 const selected=roleNames.map(name=>{const role=roles.find(r=>r.name===name);if(!role)throw Error('Required role unavailable');return role;});
 await req(base+'/users/'+user.id+'/role-mappings/clients/'+orClients[0].id,admin,'POST',selected);
 return{client,user,secret};
}
let bootstrap,writer,asset,done=false;
try{
 bootstrap=await createClient('gridex-history-setup-'+randomBytes(6).toString('hex'),['read:assets','write:assets']);
 const setup=await token('gridex',{grant_type:'client_credentials',client_id:bootstrap.client.clientId,client_secret:bootstrap.secret});
 writer=await createClient('gridex-history-'+binding.gatewayId.replaceAll('-','').slice(0,16),['read:assets','write:attributes']);
 const restricted=await req(base+'/roles/restricted_user',admin);
 await req(base+'/users/'+writer.user.id+'/role-mappings/realm',admin,'POST',[restricted]);
 const parent=rows.rows[0].openremote_site_asset_id;
 if(parent)await req(or+'/asset/'+parent,setup);
 asset=await req(or+'/asset',setup,'POST',{name:'ROCK Pi CPU temperature',type:'ThingAsset',realm:'gridex',...(parent?{parentId:parent}:{}),attributes:{
  location:{type:'GEO_JSONPoint',value:null,meta:{}},
  notes:{type:'text',value:'ROCK CPU temperature history; waiting for physical sensor publication.',meta:{}},
  gridexSiteId:{type:'text',value:binding.siteId,meta:{}},
  gridexGatewayId:{type:'text',value:binding.gatewayId,meta:{}},
  cpuTemperatureC:{type:'number',value:null,meta:{storeDataPoints:true,accessRestrictedRead:true,accessRestrictedWrite:true,readOnly:true}},
  measurementKind:{type:'text',value:'cpu-temperature-celsius',meta:{readOnly:true}}
 }});
 if(!asset?.id)throw Error('Asset creation returned no ID');
 for(const id of [writer.user.id,users[0].id])await req(or+'/asset/user/link',setup,'POST',[{id:{realm:'gridex',userId:id,assetId:asset.id}}]);
 const writerToken=await token('gridex',{grant_type:'client_credentials',client_id:writer.client.clientId,client_secret:writer.secret});
 const visible=await req(or+'/asset/query',writerToken,'POST',{});
 if(visible.length!==1||visible[0].id!==asset.id)throw Error('Writer scope is not limited to its measurement asset');
 const result={clientId:writer.client.clientId,secret:writer.secret,clientResourceId:writer.client.id,assetId:asset.id,
  bindings:[{siteId:binding.siteId,gatewayId:binding.gatewayId,sourceGateway:binding.gateway,assetId:asset.id,
   topic:(cfg.prefix||'gridex/v1')+'/sites/'+binding.site+'/edge/'+binding.gateway+'/health',metric:'cpuTemperatureC'}]};
 console.log(JSON.stringify(result));done=true;
}finally{
 if(!done&&asset&&bootstrap){try{const t=await token('gridex',{grant_type:'client_credentials',client_id:bootstrap.client.clientId,client_secret:bootstrap.secret});await req(or+'/asset?assetId='+asset.id,t,'DELETE');}catch{}}
 if(!done&&writer)await req(base+'/clients/'+writer.client.id,admin,'DELETE');
 if(bootstrap)await req(base+'/clients/'+bootstrap.client.id,admin,'DELETE');
 await repo.close();
}
