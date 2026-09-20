import {ApiError} from './errors.mjs';
const attr=(asset,name)=>asset?.attributes?.[name]?.value;
const pending=()=>new ApiError(409,'inventory_reconciliation_required','Inventory must be provisioned and linked in OpenRemote.');
async function ownedAssets(openRemote,ids,subject) {
 if(!subject||ids.some(id=>!id)||new Set(ids).size!==ids.length) throw pending();
 if(!ids.length)return [];
 try {
  const assets=await openRemote.getUserLinkedAssets(ids,subject);
  if(!Array.isArray(assets))throw Error('Invalid inventory response');
  return assets;
 }catch {throw new ApiError(503,'inventory_unavailable','OpenRemote inventory is temporarily unavailable.');}
}
function verifySite(site,asset) {
 if(!asset||asset.realm!==site.openremoteRealm||attr(asset,'gridexResourceKind')!=='site'||attr(asset,'gridexResourceId')!==site.id||!asset.name) throw pending();
}
export async function authoritativeSites(sites,openRemote,subject) {
 const bound=sites.filter(s=>s.openremoteSiteAssetId);
 const assets=await ownedAssets(openRemote,bound.map(s=>s.openremoteSiteAssetId),subject);
 return bound.flatMap(site=>{
  const asset=assets.find(a=>a.id===site.openremoteSiteAssetId);
  if(!asset)return []; // A removed OR user link revokes visibility.
  verifySite(site,asset);
  return [{...site,name:asset.name}];
 });
}
export async function authoritativeTopology(site,repository,openRemote,subject) {
 if(!site.openremoteSiteAssetId)throw pending();
 const local=await repository.getTopology(site.id);
 const bindings=await repository.getGatewayBindings(site.id);
 if(bindings.length!==local.gateways.length||local.gateways.some(g=>!bindings.some(b=>b.gatewayId===g.id)))throw pending();
 if(local.devices.some(d=>!d.openremoteAssetId))throw pending();
 const ids=[site.openremoteSiteAssetId,...bindings.map(b=>b.assetId),...local.devices.map(d=>d.openremoteAssetId)];
 const assets=await ownedAssets(openRemote,ids,subject);
 if(assets.length!==ids.length||ids.some(id=>!assets.some(a=>a.id===id)))throw pending();
 const byId=new Map(assets.map(a=>[a.id,a]));
 const siteAsset=byId.get(site.openremoteSiteAssetId);verifySite(site,siteAsset);
 const gateways=local.gateways.map(g=>{
  const binding=bindings.find(b=>b.gatewayId===g.id),asset=byId.get(binding.assetId);
  const role=attr(asset,'gatewayRole'),model=attr(asset,'hardwareModel');
  if(asset.realm!==site.openremoteRealm||attr(asset,'gridexResourceKind')!=='gateway'||attr(asset,'gridexResourceId')!==g.id||attr(asset,'gridexSiteId')!==site.id||!asset.name||!model||!['controller','device-node'].includes(role))throw pending();
  if(role==='controller'&&asset.parentId!==siteAsset.id)throw pending();
  if(role==='device-node') {
   const parent=byId.get(asset.parentId);
   if(!parent||attr(parent,'gatewayRole')!=='controller'||parent.parentId!==siteAsset.id)throw pending();
  }
  // Local ports are execution configuration only; name/model/role come from OR.
  return {...g,name:asset.name,hardwareModel:model,role,inventorySource:'openremote',provisioningStatus:'verified'};
 });
 const devices=local.devices.map(d=>{
  const asset=byId.get(d.openremoteAssetId);
  const validParents=[siteAsset.id,...bindings.map(b=>b.assetId),...local.devices.filter(p=>p.id===d.parentDeviceId).map(p=>p.openremoteAssetId)];
  if(asset.realm!==site.openremoteRealm||attr(asset,'gridexDeviceId')!==d.id||!validParents.includes(asset.parentId)||!asset.name)throw pending();
  return {...d,name:asset.name};
 });
 return {...local,gateways,devices,inventorySource:'openremote',inventoryVerifiedAt:new Date().toISOString()};
}
