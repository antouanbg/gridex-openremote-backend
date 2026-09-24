import test from 'node:test';import assert from 'node:assert/strict';
import {verifyPilot} from './verify-pilot-inventory.mjs';
function fixture(){
 const asset=(id,kind,local,parentId)=>({id,realm:'gridex',parentId,attributes:{gridexResourceKind:{value:kind},gridexResourceId:{value:local}}});
 return {site:{id:'s',openremote_site_asset_id:'S'},gateways:[{id:'r',role:'controller'},{id:'e',role:'device-node'}],
 assets:[asset('S','site','s'),asset('R','gateway','r','S'),asset('E','gateway','e','R'),asset('T','measurement','t','R')],
 gatewayBindings:[{gateway_id:'r',openremote_asset_id:'R'},{gateway_id:'e',openremote_asset_id:'E'}],
 links:['S','R','E','T'].map(assetId=>({id:{realm:'gridex',assetId,userId:'u'}})),
 owner:{id:'u',canReadAssets:true,realmRoles:['restricted_user']},temperatureId:'T',writerScopeVerified:true};
}
test('complete owned OpenRemote tree passes',()=>assert.equal(verifyPilot(fixture()).resources,3));
for(const [name,change] of [
 ['duplicate',s=>s.assets.push({...s.assets[1],id:'R2'})],
 ['wrong parent',s=>s.assets[2].parentId='S'],
 ['missing binding',s=>s.gatewayBindings.pop()],
 ['foreign owner',s=>s.links[0].id.userId='other'],
 ['missing permission',s=>s.owner.canReadAssets=false],
 ['unrestricted identity',s=>s.owner.realmRoles=[]],
 ['writer scope changed',s=>s.writerScopeVerified=false]
]) test('reject '+name,()=>{const s=fixture();change(s);assert.throws(()=>verifyPilot(s));});
