// Isolated synthetic acceptance test. Never writes owner sensor data.
import{randomBytes}from'node:crypto';import pg from'pg';
let input='';for await(const c of process.stdin)input+=c;const cfg=JSON.parse(input);
const kc='http://keycloak:8080/auth',base=kc+'/admin/realms/gridex',or='http://manager:8080/api/gridex';
async function req(url,token,method='GET',body){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Probe HTTP '+r.status);const t=await r.text();return t?JSON.parse(t):null;}
async function token(realm,body){const r=await fetch(kc+'/realms/'+realm+'/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams(body)});if(!r.ok)throw Error('Probe token failed');return(await r.json()).access_token;}
const admin=await token('master',{grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password});
const clientId='gridex-history-probe-'+randomBytes(6).toString('hex'),secret=randomBytes(32).toString('hex');
let client,asset,service;
const db=new pg.Pool({host:'postgresql',user:'postgres',database:'openremote',password:cfg.dbPassword});
try{
 await req(base+'/clients',admin,'POST',{clientId,secret,enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false});
 [client]=await req(base+'/clients?clientId='+clientId,admin);
 const user=await req(base+'/clients/'+client.id+'/service-account-user',admin);
 const [orc]=await req(base+'/clients?clientId=openremote',admin);
 const roles=await req(base+'/clients/'+orc.id+'/roles',admin);
 await req(base+'/users/'+user.id+'/role-mappings/clients/'+orc.id,admin,'POST',roles.filter(r=>['read:assets','write:assets','write:attributes'].includes(r.name)));
 service=await token('gridex',{grant_type:'client_credentials',client_id:clientId,client_secret:secret});
 asset=await req(or+'/asset',service,'POST',{name:'Temporary synthetic history acceptance probe',realm:'gridex',type:'ThingAsset',attributes:{location:{type:'GEO_JSONPoint',value:null},notes:{type:'text',value:'Synthetic; automatically removed.'},probeValue:{type:'number',value:null,meta:{storeDataPoints:true}}}});
 const observedAt=Date.now();
 const result=await req(or+'/asset/'+asset.id+'/attribute/probeValue/'+observedAt,service,'PUT',42.125);
 if(result?.failure)throw Error('Probe attribute write rejected');
 let found=false;
 for(let n=0;n<20;n++){const r=await db.query('SELECT value FROM openremote.asset_datapoint WHERE entity_id=$1 AND attribute_name=$2',[asset.id,'probeValue']);if(r.rows.some(x=>Number(x.value)===42.125)){found=true;break;}await new Promise(r=>setTimeout(r,500));}
 if(!found)throw Error('Synthetic datapoint not found in Timescale');
 const restricted=await token('gridex',{grant_type:'client_credentials',client_id:cfg.writerId,client_secret:cfg.writerSecret});
 const denied=await fetch(or+'/asset/'+asset.id,{headers:{Authorization:'Bearer '+restricted}});
 if(![403,404].includes(denied.status))throw Error('Restricted writer can access unrelated asset');
 console.log('PASS synthetic timestamped attribute -> Timescale row; restricted writer denied unrelated asset. Not physical sensor evidence.');
}finally{
 if(asset&&service){await req(or+'/asset?assetId='+asset.id,service,'DELETE');await db.query('DELETE FROM openremote.asset_datapoint WHERE entity_id=$1',[asset.id]);}
 if(client)await req(base+'/clients/'+client.id,admin,'DELETE');
 await db.end();
}
