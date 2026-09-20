// Runs inside the API container. Private stdin/stdout; never prints credentials.
import {randomBytes} from 'node:crypto';
import {createRepository} from './src/repository.mjs';
import {loadConfig} from './src/config.mjs';
let input=''; for await(const chunk of process.stdin) input+=chunk;
const cfg=JSON.parse(input), repo=createRepository(loadConfig());
const kc='http://keycloak:8080/auth', base=kc+'/admin/realms/gridex', api='http://manager:8080/api/gridex';
async function request(url, bearer, method='GET', body) {
 const r=await fetch(url,{method,headers:{Authorization:'Bearer '+bearer,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 if(!r.ok) throw Error('OpenRemote/identity request failed: '+r.status+' '+method+' '+new URL(url).pathname);
 const value=await r.text(); return value?JSON.parse(value):null;
}
async function token(realm, values) {
 const r=await fetch(kc+'/realms/'+realm+'/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams(values),signal:AbortSignal.timeout(15000)});
 if(!r.ok) throw Error('Authentication failed: '+r.status);
 return (await r.json()).access_token;
}
const db=await repo.pool.connect(); let bootstrap,admin;
try {
 await db.query("SELECT pg_advisory_lock(hashtext('gridex-pilot-or-reconciliation'))");
 admin=await token('master',{grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password});
 const users=await request(base+'/users?exact=true&email='+encodeURIComponent(cfg.email),admin);
 if(users.length!==1||!users[0].enabled) throw Error('Exactly one enabled owner required');
 const owner=users[0];
 if(cfg.bindings.length!==1) throw Error('Exactly one approved pilot binding required');
 const binding=cfg.bindings[0];
 const result=await db.query(`SELECT s.* FROM sites s JOIN organisation_memberships m ON m.organisation_id=s.organisation_id
 WHERE s.id=$1 AND s.deleted_at IS NULL AND s.openremote_realm='gridex' AND m.subject=$2 AND m.role='administrator'
 AND (m.all_sites OR EXISTS(SELECT 1 FROM membership_site_grants x WHERE x.subject=m.subject AND x.site_id=s.id AND x.organisation_id=m.organisation_id))`,[binding.siteId,owner.id]);
 if(result.rowCount!==1) throw Error('Owner administration of pilot Site not verified');
 const site=result.rows[0];
 const gateways=(await db.query('SELECT id,site_id,name,hardware_model,role FROM gateways WHERE site_id=$1 ORDER BY role,id',[site.id])).rows;
 const rocks=gateways.filter(g=>g.role==='controller'&&g.id===binding.gatewayId);
 const nodes=gateways.filter(g=>g.role==='device-node');
 if(gateways.length!==2||rocks.length!==1||nodes.length!==1) throw Error('Expected exact existing two-device pilot');
 const [rock]=rocks,[esp]=nodes;
 const clients=await request(base+'/clients?clientId=openremote',admin);
 if(clients.length!==1) throw Error('Missing OpenRemote role client');
 const roles=await request(base+'/clients/'+clients[0].id+'/roles',admin);
 let ownerRoles=await request(base+'/users/'+owner.id+'/role-mappings/clients/'+clients[0].id+'/composite',admin);
 const ownerRealmRoles=await request(base+'/users/'+owner.id+'/role-mappings/realm/composite',admin);
 const clientId='gridex-inventory-setup-'+randomBytes(8).toString('hex'),secret=randomBytes(32).toString('hex');
 await request(base+'/clients',admin,'POST',{clientId,secret,enabled:true,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false,fullScopeAllowed:true});
 [bootstrap]=await request(base+'/clients?clientId='+clientId,admin);
 const serviceUser=await request(base+'/clients/'+bootstrap.id+'/service-account-user',admin);
 // Temporary setup identity needs read:admin to verify another user's links.
 const names=cfg.apply?['read:assets','write:assets','read:admin']:['read:assets','read:admin'];
 const selected=names.map(n=>{const r=roles.find(r=>r.name===n);if(!r)throw Error('Missing asset role');return r;});
 await request(base+'/users/'+serviceUser.id+'/role-mappings/clients/'+clients[0].id,admin,'POST',selected);
 const auth=await token('gridex',{grant_type:'client_credentials',client_id:clientId,client_secret:secret});
 const assets=await request(api+'/asset/query',auth,'POST',{});
 const links=await request(api+'/asset/user/link?realm=gridex&userId='+encodeURIComponent(owner.id),auth);
 const history=(cfg.history||[]).filter(h=>h.siteId===site.id&&h.gatewayId===rock.id);
 if(history.length!==1) throw Error('Exactly one existing temperature binding required');
 const temperature=await request(api+'/asset/'+history[0].assetId,auth);
 if(temperature.realm!=='gridex'||temperature.attributes?.gridexGatewayId?.value!==rock.id) throw Error('Temperature ownership mismatch');
 const writerToken=await token('gridex',{grant_type:'client_credentials',client_id:cfg.writerId,client_secret:cfg.writerSecret});
 const writerAssets=await request(api+'/asset/query',writerToken,'POST',{});
 if(writerAssets.length!==1||writerAssets[0].id!==temperature.id) throw Error('History writer scope must remain one measurement asset');
 if(!cfg.apply) {
  const bindingTable=await db.query("SELECT to_regclass('gateway_openremote_bindings') AS name");
  const gatewayBindings=bindingTable.rows[0].name?(await db.query('SELECT b.* FROM gateway_openremote_bindings b JOIN gateways g ON g.id=b.gateway_id WHERE g.site_id=$1',[site.id])).rows:[];
  console.log(JSON.stringify({site,gateways,assets,links,gatewayBindings,owner:{id:owner.id,username:owner.username,canReadAssets:ownerRoles.some(r=>r.name==='read:assets'),clientRoles:ownerRoles.map(r=>r.name),realmRoles:ownerRealmRoles.map(r=>r.name)},writerScopeVerified:true,temperatureId:temperature.id}));
 } else {
  const attr=value=>({type:'text',value,meta:{readOnly:true,accessRestrictedRead:true}});
  const value=(a,key)=>a.attributes?.[key]?.value;
  async function ensure(kind,localId,name,parentId,extra={}) {
   const matches=assets.filter(a=>value(a,'gridexResourceKind')===kind&&value(a,'gridexResourceId')===localId);
   if(matches.length>1) throw Error('Duplicate OR identities: manual reconciliation required');
   let asset=matches[0];
   if(!asset&&kind==='site'&&site.openremote_site_asset_id) throw Error('Existing Site binding needs explicit reconciliation');
   if(!asset&&assets.some(a=>a.name===name)) throw Error('Existing same-name asset requires explicit reconciliation');
   if(!asset) {
    asset=await request(api+'/asset',auth,'POST',{name,type:'ThingAsset',realm:'gridex',...(parentId?{parentId}:{}),attributes:{location:{type:'GEO_JSONPoint',value:null,meta:{}},notes:attr('Pilot inventory; physical commissioning and control approval remain separate.'),gridexResourceKind:attr(kind),gridexResourceId:attr(localId),gridexSiteId:attr(site.id),...extra}});
    if(!asset?.id) throw Error('Create returned no identity; rerun inspection before retry');
    assets.push(asset);
   }
   asset=await request(api+'/asset/'+asset.id,auth);
   if(asset.realm!=='gridex'||(asset.parentId||null)!==(parentId||null)||value(asset,'gridexResourceId')!==localId) throw Error('Asset hierarchy verification failed');
   return asset;
  }
  const siteAsset=await ensure('site',site.id,site.name,null);
  const rockAsset=await ensure('gateway',rock.id,rock.name,siteAsset.id,{hardwareModel:attr(rock.hardware_model),gatewayRole:attr(rock.role),gridexGatewayId:attr(rock.id)});
  const espAsset=await ensure('gateway',esp.id,esp.name,rockAsset.id,{hardwareModel:attr(esp.hardware_model),gatewayRole:attr(esp.role),gridexGatewayId:attr(esp.id)});
  if(temperature.parentId&&temperature.parentId!==rockAsset.id) throw Error('Temperature has an unexpected parent');
  if(temperature.parentId!==rockAsset.id) await request(api+'/asset/'+temperature.id,auth,'PUT',{...temperature,parentId:rockAsset.id});
  const ids=[siteAsset.id,rockAsset.id,espAsset.id,temperature.id];
  const missing=ids.filter(id=>!links.some(l=>l.id?.assetId===id));
  if(missing.length) await request(api+'/asset/user/link',auth,'POST',missing.map(assetId=>({id:{realm:'gridex',userId:owner.id,assetId}})));
  const verifiedLinks=await request(api+'/asset/user/link?realm=gridex&userId='+encodeURIComponent(owner.id),auth);
  if(ids.some(id=>!verifiedLinks.some(l=>l.id?.assetId===id))) throw Error('Owner links not verified');
  const verifiedTemperature=await request(api+'/asset/'+temperature.id,auth);
  if(verifiedTemperature.parentId!==rockAsset.id) throw Error('Temperature parent not verified');
  // Owner requested access to this pilot, not unrestricted realm administration.
  if(!ownerRoles.some(r=>r.name==='read:assets')) {
   const restricted=await request(base+'/roles/restricted_user',admin);
   if(!ownerRealmRoles.some(r=>r.name==='restricted_user')) await request(base+'/users/'+owner.id+'/role-mappings/realm',admin,'POST',[restricted]);
   const readRole=roles.find(r=>r.name==='read:assets');
   await request(base+'/users/'+owner.id+'/role-mappings/clients/'+clients[0].id,admin,'POST',[readRole]);
   ownerRoles=await request(base+'/users/'+owner.id+'/role-mappings/clients/'+clients[0].id+'/composite',admin);
   const finalRealmRoles=await request(base+'/users/'+owner.id+'/role-mappings/realm/composite',admin);
   if(!ownerRoles.some(r=>r.name==='read:assets')||!finalRealmRoles.some(r=>r.name==='restricted_user')) throw Error('Scoped owner permission verification failed');
  }
  // ONLY projection/binding writes below. All operational assets already exist in OR.
  await db.query('BEGIN');
  try {
   await db.query(cfg.migration);
   const update=await db.query('UPDATE sites SET openremote_site_asset_id=$1,updated_at=now() WHERE id=$2 AND (openremote_site_asset_id IS NULL OR openremote_site_asset_id=$1)',[siteAsset.id,site.id]);
   if(update.rowCount!==1) throw Error('Concurrent Site binding conflict');
   for(const [g,a] of [[rock,rockAsset],[esp,espAsset]]) {
    const prior=await db.query('SELECT openremote_asset_id FROM gateway_openremote_bindings WHERE gateway_id=$1',[g.id]);
    if(prior.rowCount&&prior.rows[0].openremote_asset_id!==a.id) throw Error('Conflicting gateway binding');
    await db.query('INSERT INTO gateway_openremote_bindings(gateway_id,openremote_asset_id) VALUES($1,$2) ON CONFLICT(gateway_id) DO UPDATE SET verified_at=now()',[g.id,a.id]);
   }
   await db.query(`INSERT INTO audit_events(subject,site_id,action,resource_type,resource_id,result,request_id,details)
    VALUES($1,$2::uuid,'inventory.openremote.reconciled','site',$2::text,'success',$3,$4)`,[owner.id,site.id,crypto.randomUUID(),JSON.stringify({assetIds:ids,physicalActivation:false})]);
   await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}
  console.log(JSON.stringify({status:'verified',siteAssetId:siteAsset.id,rockAssetId:rockAsset.id,espAssetId:espAsset.id,temperatureAssetId:temperature.id,ownerLinkedAssets:ids.length,physicalActivation:false}));
 }
}finally{
 if(bootstrap&&admin) await request(base+'/clients/'+bootstrap.id,admin,'DELETE');
 await db.query("SELECT pg_advisory_unlock(hashtext('gridex-pilot-or-reconciliation'))");
 db.release();await repo.close();
}
