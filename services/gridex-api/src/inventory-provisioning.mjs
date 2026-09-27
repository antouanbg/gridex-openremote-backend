import {createHash} from 'node:crypto';
import {ApiError} from './errors.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const attr=(value)=>({type:'text',value,meta:{}});
const field=(value,name,max=120)=>{
  if(typeof value!=='string'||!value.trim()||value.trim().length>max)
    throw new ApiError(400,'invalid_inventory_input',`${name} is required and must be at most ${max} characters.`);
  return value.trim();
};
const digest=(value)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function idempotencyKey(req){
  const raw=req.headers['idempotency-key'];
  if(typeof raw!=='string'||!/^[A-Za-z0-9._:-]{8,100}$/.test(raw))
    throw new ApiError(428,'idempotency_key_required','A stable Idempotency-Key header is required.');
  return raw;
}
export function validateSiteInput(value){
  if(!value||typeof value!=='object'||!uuid.test(value.organisationId||''))
    throw new ApiError(400,'invalid_inventory_input','A valid organisationId is required.');
  const name=field(value.name,'name');
  const timezone=field(value.timezone,'timezone',80);
  try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{
    throw new ApiError(400,'invalid_inventory_input','The timezone is not valid.');
  }
  const marketCode=value.marketCode===undefined||value.marketCode===null||value.marketCode===''?null:field(value.marketCode,'marketCode',30);
  return {organisationId:value.organisationId,name,timezone,marketCode};
}
export function validateGatewayInput(value){
  if(!value||typeof value!=='object')throw new ApiError(400,'invalid_inventory_input','Gateway details are required.');
  const name=field(value.name,'name');
  const hardwareModel=field(value.hardwareModel,'hardwareModel',60);
  const role=hardwareModel==='rock-pi-e'?'controller':['olimex-esp32-evb-ea-ind','olimex-esp32-evb-lab'].includes(hardwareModel)?'device-node':null;
  if(!role)throw new ApiError(400,'unsupported_gateway','Only approved GrideX ROCK Pi E and OLIMEX ESP32-EVB devices are supported.');
  const parentGatewayId=value.parentGatewayId||null;
  if((role==='controller'&&parentGatewayId!==null)||(role==='device-node'&&!uuid.test(parentGatewayId||'')))
    throw new ApiError(400,'invalid_parent_gateway','An ESP32 must be attached to a ROCK Pi E in the same Site.');
  return {name,hardwareModel,role,parentGatewayId};
}

async function findAsset(remote,intent,token,realm){
  if(intent.openremote_asset_id)return remote.getAsset(intent.openremote_asset_id,token,realm);
  const assets=await remote.queryAssets({},token,realm);
  if(!Array.isArray(assets))throw new ApiError(503,'inventory_unavailable','OpenRemote inventory is unavailable.');
  const matches=assets.filter(asset=>asset.realm===realm&&asset.attributes?.gridexResourceId?.value===intent.resource_id);
  if(matches.length>1)throw new ApiError(409,'inventory_reconciliation_required','Duplicate OpenRemote resources require reconciliation.');
  return matches[0]||null;
}
async function verifyAsset(remote,asset,{resourceId,realm,kind,siteId,parentId,subject,token,linkIfMissing=true}){
  if(!asset?.id||asset.realm!==realm||asset.attributes?.gridexResourceKind?.value!==kind
    ||asset.attributes?.gridexResourceId?.value!==resourceId
    ||asset.attributes?.gridexSiteId?.value!==siteId
    ||(parentId||null)!==(asset.parentId||null))
    throw new ApiError(409,'inventory_reconciliation_required','OpenRemote asset identity or hierarchy did not match.');
  let linked=await remote.getUserLinkedAssets([asset.id],subject,{realm,token});
  if(linkIfMissing&&!linked?.some(item=>item.id===asset.id)){
    await remote.linkUserAsset(asset.id,subject,token,realm);
    linked=await remote.getUserLinkedAssets([asset.id],subject,{realm,token});
  }
  if(!Array.isArray(linked)||linked.length!==1||linked[0].id!==asset.id)
    throw new ApiError(409,'inventory_link_unverified','OpenRemote ownership link could not be verified.');
  return asset;
}

export async function provisionSite({repository,remote,principal,key,input}){
  const body=validateSiteInput(input);
  if(!principal.emailVerified)throw new ApiError(403,'permission_denied','Verified email is required.');
  const org=await repository.requireOrganisationAdministrator(principal.subject,principal.realm,body.organisationId);
  const claimed=await repository.claimInventoryIntent({organisationId:org.id,kind:'site',key,payloadHash:digest(body),subject:principal.subject,realm:org.realm});
  const intent=claimed.intent;
  if(claimed.complete){
    const asset=await remote.getAsset(intent.openremote_asset_id,principal.accessToken,org.realm);
    await verifyAsset(remote,asset,{resourceId:intent.resource_id,realm:org.realm,kind:'site',siteId:intent.resource_id,parentId:null,
      subject:principal.subject,token:principal.accessToken,linkIfMissing:false});
    return repository.requireSite(principal.subject,intent.resource_id,principal.realm);
  }
  try{
    let asset=await findAsset(remote,intent,principal.accessToken,org.realm);
    if(!asset)asset=await remote.createUserAsset({name:body.name,type:'ThingAsset',realm:org.realm,attributes:{
      location:{type:'GEO_JSONPoint',value:null,meta:{}},gridexResourceKind:attr('site'),
      gridexResourceId:attr(intent.resource_id),gridexSiteId:attr(intent.resource_id),
    }},principal.accessToken,org.realm);
    await verifyAsset(remote,asset,{resourceId:intent.resource_id,realm:org.realm,kind:'site',siteId:intent.resource_id,parentId:null,subject:principal.subject,token:principal.accessToken});
    await repository.recordInventoryAsset(intent.id,asset.id);
    return await repository.completeSiteIntent(intent,body,asset.id);
  }catch(error){await repository.failInventoryIntent(intent.id);throw error;}
}

export async function provisionGateway({repository,remote,principal,site,key,input}){
  const body=validateGatewayInput(input);
  if(site.membershipRole!=='administrator'||!principal.emailVerified)
    throw new ApiError(403,'permission_denied','Organisation administrator access is required.');
  const claimed=await repository.claimInventoryIntent({organisationId:site.organisationId,siteId:site.id,kind:'gateway',key,
    payloadHash:digest(body),subject:principal.subject,realm:site.openremoteRealm});
  const intent=claimed.intent;
  if(claimed.complete){
    const topology=await repository.getTopology(site.id);
    const parent=body.role==='controller'?site.openremoteSiteAssetId:(await repository.getGatewayBindings(site.id))
      .find(binding=>binding.gatewayId===body.parentGatewayId)?.assetId;
    const asset=await remote.getAsset(intent.openremote_asset_id,principal.accessToken,site.openremoteRealm);
    await verifyAsset(remote,asset,{resourceId:intent.resource_id,realm:site.openremoteRealm,kind:'gateway',siteId:site.id,parentId:parent,
      subject:principal.subject,token:principal.accessToken,linkIfMissing:false});
    if(!topology.gateways.some(g=>g.id===intent.resource_id))throw new ApiError(409,'inventory_reconciliation_required','Gateway projection is missing.');
    return {id:intent.resource_id,siteId:site.id,name:asset.name,hardwareModel:body.hardwareModel,role:body.role,openremoteAssetId:asset.id};
  }
  try{
    const topology=await repository.getTopology(site.id);
    if(topology.configuration&&topology.configuration.status!=='draft')
      throw new ApiError(409,'configuration_not_draft','New hardware can only be added to a draft configuration.');
    const rock=topology.gateways.find(g=>g.role==='controller'&&g.hardwareModel==='rock-pi-e');
    if(body.role==='controller'&&rock)throw new ApiError(409,'controller_exists','This Site already has a ROCK Pi E controller.');
    if(body.role==='device-node'&&(!rock||rock.id!==body.parentGatewayId))
      throw new ApiError(400,'invalid_parent_gateway','Select the ROCK Pi E controller in this Site.');
    const bindings=await repository.getGatewayBindings(site.id);
    const parentId=body.role==='controller'?site.openremoteSiteAssetId:bindings.find(b=>b.gatewayId===rock.id)?.assetId;
    if(!parentId)throw new ApiError(409,'inventory_reconciliation_required','Parent OpenRemote asset is not verified.');
    let asset=await findAsset(remote,intent,principal.accessToken,site.openremoteRealm);
    if(!asset)asset=await remote.createUserAsset({name:body.name,type:'ThingAsset',realm:site.openremoteRealm,parentId,attributes:{
      location:{type:'GEO_JSONPoint',value:null,meta:{}},gridexResourceKind:attr('gateway'),
      gridexResourceId:attr(intent.resource_id),gridexSiteId:attr(site.id),
      gridexGatewayId:attr(intent.resource_id),gatewayRole:attr(body.role),hardwareModel:attr(body.hardwareModel),
    }},principal.accessToken,site.openremoteRealm);
    await verifyAsset(remote,asset,{resourceId:intent.resource_id,realm:site.openremoteRealm,kind:'gateway',siteId:site.id,parentId,
      subject:principal.subject,token:principal.accessToken});
    await repository.recordInventoryAsset(intent.id,asset.id);
    return await repository.completeGatewayIntent(intent,body,asset.id,principal.subject);
  }catch(error){await repository.failInventoryIntent(intent.id);throw error;}
}
