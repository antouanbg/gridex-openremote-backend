import assert from 'node:assert/strict';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export function verifyPilot(s) {
 const value=(a,k)=>a.attributes?.[k]?.value;
 const unique=(kind,id)=>{
  const matches=s.assets.filter(a=>value(a,'gridexResourceKind')===kind&&value(a,'gridexResourceId')===id);
  assert.equal(matches.length,1,'Resource must map to exactly one OpenRemote asset');
  assert.equal(matches[0].realm,'gridex');return matches[0];
 };
 assert.equal(s.gateways.length,2);
 assert.equal(s.gatewayBindings.length,2);
 const site=unique('site',s.site.id);
 assert.equal(site.id,s.site.openremote_site_asset_id);
 assert.ok(!site.parentId);
 const rock=s.gateways.find(g=>g.role==='controller');
 const esp=s.gateways.find(g=>g.role==='device-node');
 assert.ok(rock&&esp);
 const rockAsset=unique('gateway',rock.id),espAsset=unique('gateway',esp.id);
 assert.equal(rockAsset.parentId,site.id);
 assert.equal(espAsset.parentId,rockAsset.id);
 for(const [g,a] of [[rock,rockAsset],[esp,espAsset]]) {
  assert.equal(s.gatewayBindings.find(b=>b.gateway_id===g.id)?.openremote_asset_id,a.id);
 }
 const temperature=s.assets.find(a=>a.id===s.temperatureId);
 assert.ok(temperature);assert.equal(temperature.parentId,rockAsset.id);
 for(const a of [site,rockAsset,espAsset,temperature]) {
  assert.ok(s.links.some(l=>l.id?.assetId===a.id&&l.id?.userId===s.owner.id&&l.id?.realm==='gridex'),'Missing verified owner link');
 }
 assert.equal(s.owner.canReadAssets,true);
 assert.ok(s.owner.realmRoles.includes('restricted_user'));
 assert.equal(s.writerScopeVerified,true);
 return {resources:3,measurementAssets:1,ownerLinks:4,bindings:2};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
 console.log(JSON.stringify(verifyPilot(JSON.parse(fs.readFileSync(process.argv[2],'utf8')))));
}
