// Only the separate localhost fixture stack. Never takes live settings or sends mail.
import assert from 'node:assert/strict';
import { OpenRemoteRealmSetup } from '../../services/gridex-api/src/organisation-onboarding.mjs';
const kc='http://127.0.0.1:58080/auth', or='http://127.0.0.1:58081';
const password='fixture-only-not-for-live';
async function request(url,method='GET',body,token) {
  const response=await fetch(url,{method,headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error(`Fixture HTTP ${response.status} at ${new URL(url).pathname}`);
  const text=await response.text();return text?JSON.parse(text):null;
}
async function token(realm,client,secret) {
  const body=secret?{grant_type:'client_credentials',client_id:client,client_secret:secret}:{grant_type:'password',client_id:client,username:'admin',password};
  const response=await fetch(`${kc}/realms/${realm}/protocol/openid-connect/token`,{method:'POST',body:new URLSearchParams(body),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Fixture token failed (${response.status})`);return (await response.json()).access_token;
}
const admin=await token('master','admin-cli');
async function client(realm,name,confidential=true) {
  const root=`${kc}/admin/realms/${realm}/clients`;
  let [found]=await request(`${root}?clientId=${name}`,'GET',undefined,admin);
  if(!found){await request(root,'POST',{clientId:name,protocol:'openid-connect',publicClient:!confidential,secret:password,serviceAccountsEnabled:confidential,directAccessGrantsEnabled:!confidential,standardFlowEnabled:true,redirectUris:['http://127.0.0.1:58081/*'],protocolMappers:[{name:'audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',config:{'included.client.audience':'openremote','access.token.claim':'true'}}]},admin);[found]=await request(`${root}?clientId=${name}`,'GET',undefined,admin);}
  return found;
}
await client('master','fixture-master',false);
const master=await token('master','fixture-master');
const setup=new OpenRemoteRealmSetup({realm:'gridex',openRemoteBaseUrl:or,realmSetupAdminBaseUrl:`${kc}/admin/realms`});
setup.token=async()=>master;
const realms=await request(`${or}/api/master/realm`,'GET',undefined,master);
for(const realm of ['customer','other']) {
  if(!realms.some(r=>r.name===realm))await setup.createRealm({realm,name:realm});
  else if(!realms.find(r=>r.name===realm).enabled)await setup.setOrganisationAccess(realm,true);
  const c=await client(realm,'fixture-service');
  const user=await request(`${kc}/admin/realms/${realm}/clients/${c.id}/service-account-user`,'GET',undefined,admin);
  const [orClient]=await request(`${kc}/admin/realms/${realm}/clients?clientId=openremote`,'GET',undefined,admin);
  const roles=await request(`${kc}/admin/realms/${realm}/clients/${orClient.id}/roles`,'GET',undefined,admin);
  await request(`${kc}/admin/realms/${realm}/users/${user.id}/role-mappings/clients/${orClient.id}`,'POST',roles.filter(r=>['read:assets','write:assets','read:admin'].includes(r.name)),admin);
}
for (const realm of ['customer','other']) {
  const existing=await request(`${or}/api/master/asset/query`,'POST',{realm:{name:realm}},master);
  if(!existing.length)await request(`${or}/api/master/asset`,'POST',{realm,name:`Preserved ${realm} fixture`,type:'ThingAsset',attributes:{notes:{type:'text',value:'Synthetic access test'},location:{type:'geoJSONPoint',value:null}}},master);
}
const old=await token('customer','fixture-service',password),other=await token('other','fixture-service',password);
const query=(realm,t)=>fetch(`${or}/api/${realm}/asset/query`,{method:'POST',headers:{Authorization:`Bearer ${t}`,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
const beforeAssets=await (await query('customer',old)).json();assert.ok(Array.isArray(beforeAssets)&&beforeAssets.length>0);
assert.equal((await query('other',other)).status,200);
assert.equal((await query('other',old)).status,401);
const ws=new WebSocket(`ws://127.0.0.1:58081/websocket/events?Realm=customer&Authorization=${encodeURIComponent('Bearer '+old)}`);
await Promise.race([new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=()=>reject(Error('Fixture websocket open failed'));}),new Promise((_,reject)=>setTimeout(()=>reject(Error('Fixture websocket timeout')),10000))]);
let closed=false;ws.onclose=()=>{closed=true;};
await new Promise(r=>setTimeout(r,300));
await setup.setOrganisationAccess('customer',false);
assert.equal((await query('customer',old)).status,401);
assert.equal((await query('other',other)).status,200);
await new Promise(r=>setTimeout(r,300));assert.ok(closed,'Existing customer websocket must close');
for (const [locale,message] of [['en','Contact the super administrator'],['bg','Свържете се със супер администратора']]) {
  const denied=await fetch(`${kc}/realms/customer/protocol/openid-connect/auth?client_id=fixture-service&redirect_uri=${encodeURIComponent(or+'/')}&response_type=code&scope=openid&ui_locales=${locale}`, {headers:{'Accept-Language':locale}});
  assert.ok((await denied.text()).includes(message),`Direct login suspension message: ${locale}`);
}
await setup.setOrganisationAccess('customer',true);
assert.equal((await query('customer',old)).status,401);
await new Promise(r=>setTimeout(r,1200));
const fresh=await token('customer','fixture-service',password);
const restoredAssets=await (await query('customer',fresh)).json();
assert.deepEqual(restoredAssets.map(x=>x.id).sort(),beforeAssets.map(x=>x.id).sort());
assert.equal((await query('other',other)).status,200);
assert.equal((await request(`${or}/api/master/realm`,'GET',undefined,master)).length,realms.length+['customer','other'].filter(r=>!realms.some(x=>x.name===r)).length);
console.log('PASS isolated real JWT: initial access, cross-realm denial, suspend, existing WebSocket close, login explanation, other realm preservation, restore, old-token denial and fresh-token access. No email sent.');
