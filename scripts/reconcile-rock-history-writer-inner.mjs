// Runs only in the API container. Never prints credentials or tokens.
import { randomBytes } from 'node:crypto';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const cfg = JSON.parse(input);
const realm = 'gridex';
const keycloak = 'http://keycloak:8080/auth';
const adminBase = `${keycloak}/admin/realms/${realm}`;
const apiBase = `http://manager:8080/api/${realm}`;
const systemBindings = cfg.bindings.filter(b => b.topic?.endsWith('/system/telemetry'));
if (systemBindings.length !== 6 || new Set(systemBindings.map(b => b.assetId)).size !== 6 ||
    new Set(systemBindings.map(b => b.gatewayId)).size !== 1) {
  throw Error('Expected exactly six distinct ROCK system telemetry assets on one gateway');
}

async function token(targetRealm, fields) {
  const response = await fetch(`${keycloak}/realms/${targetRealm}/protocol/openid-connect/token`, {
    method: 'POST', body: new URLSearchParams(fields), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`Token request failed: ${response.status}`);
  return (await response.json()).access_token;
}
async function request(url, auth, method = 'GET', body) {
  const response = await fetch(url, {
    method, headers: { Authorization: `Bearer ${auth}`, ...(body === undefined ? {} : {'Content-Type': 'application/json'}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error(`OpenRemote/Keycloak ${method} failed: ${response.status}`);
  const value = await response.text();
  return value ? JSON.parse(value) : null;
}

const admin = await token('master', {grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.adminPassword});
const writerClients = await request(`${adminBase}/clients?clientId=${encodeURIComponent(cfg.writerId)}`, admin);
if (writerClients.length !== 1) throw Error('Writer service client not unique');
const writerUser = await request(`${adminBase}/clients/${writerClients[0].id}/service-account-user`, admin);
if (!writerUser?.id) throw Error('Writer service account user missing');
const realmRoles = await request(`${adminBase}/users/${writerUser.id}/role-mappings/realm`, admin);
if (!realmRoles.some(role => role.name === 'restricted_user')) throw Error('Writer is not restricted_user');
const orClients = await request(`${adminBase}/clients?clientId=openremote`, admin);
if (orClients.length !== 1) throw Error('OpenRemote client missing');
const writerRoles = await request(`${adminBase}/users/${writerUser.id}/role-mappings/clients/${orClients[0].id}`, admin);
for (const required of ['read:assets','write:attributes']) {
  if (!writerRoles.some(role => role.name === required)) throw Error(`Writer missing ${required}`);
}
if (writerRoles.some(role => role.name === 'write:assets')) throw Error('Writer has unexpected write:assets privilege');

let setupResourceId;
try {
  const clientId = `gridex-history-link-setup-${randomBytes(6).toString('hex')}`;
  const secret = randomBytes(32).toString('hex');
  await request(`${adminBase}/clients`, admin, 'POST', {
    clientId, secret, enabled:true, publicClient:false, serviceAccountsEnabled:true,
    standardFlowEnabled:false, directAccessGrantsEnabled:false, fullScopeAllowed:true,
    protocolMappers:[{name:'openremote-audience',protocol:'openid-connect',protocolMapper:'oidc-audience-mapper',
      config:{'included.client.audience':'openremote','access.token.claim':'true'}}],
  });
  const [setupClient] = await request(`${adminBase}/clients?clientId=${clientId}`, admin);
  if (!setupClient?.id) throw Error('Temporary setup client missing');
  setupResourceId = setupClient.id;
  const setupUser = await request(`${adminBase}/clients/${setupClient.id}/service-account-user`, admin);
  const allRoles = await request(`${adminBase}/clients/${orClients[0].id}/roles`, admin);
  // Reading another user's direct links requires read:admin in OpenRemote.
  const roles = ['read:assets','write:assets','read:admin'].map(name => allRoles.find(role => role.name === name));
  if (roles.some(role => !role)) throw Error('Setup role unavailable');
  await request(`${adminBase}/users/${setupUser.id}/role-mappings/clients/${orClients[0].id}`, admin, 'POST', roles);
  const setupToken = await token(realm, {grant_type:'client_credentials',client_id:clientId,client_secret:secret});
  const linksUrl = `${apiBase}/asset/user/link?realm=${realm}&userId=${encodeURIComponent(writerUser.id)}`;
  const before = await request(linksUrl, setupToken);
  const linked = new Set(before.map(link => link.id?.assetId));
  const missing = [];
  for (const binding of systemBindings) {
    const asset = await request(`${apiBase}/asset/${encodeURIComponent(binding.assetId)}`, setupToken);
    if (asset?.attributes?.gridexGatewayId?.value !== binding.gatewayId ||
        !asset.attributes?.[binding.metric] ||
        (binding.metric !== 'cpuTemperatureC' && asset.attributes?.gridexMetricId?.value !== binding.metric)) {
      throw Error(`System asset verification failed: ${binding.metric}`);
    }
    if (!linked.has(binding.assetId)) missing.push(binding.assetId);
  }
  const beforeIds = [...linked].sort();
  if (cfg.apply && missing.length) {
    await request(`${apiBase}/asset/user/link`, setupToken, 'POST', missing.map(assetId => ({id:{realm,userId:writerUser.id,assetId}})));
  }
  const after = cfg.apply ? await request(linksUrl, setupToken) : before;
  const afterIds = new Set(after.map(link => link.id?.assetId));
  if (cfg.apply && systemBindings.some(binding => !afterIds.has(binding.assetId))) throw Error('Writer link verification failed');
  if (cfg.apply) {
    const writerToken = await token(realm, {grant_type:'client_credentials',client_id:cfg.writerId,client_secret:cfg.writerSecret});
    for (const binding of systemBindings) {
      await request(`${apiBase}/asset/${encodeURIComponent(binding.assetId)}`, writerToken);
    }
    const visible = await request(`${apiBase}/asset/query`, writerToken, 'POST', {});
    const visibleIds = visible.map(asset => asset.id).sort();
    if (visibleIds.length !== systemBindings.length || visibleIds.some((id, i) => id !== systemBindings.map(b => b.assetId).sort()[i])) {
      throw Error('Writer asset visibility exceeds or misses the six system assets');
    }
  }
  console.log(JSON.stringify({writerUserId:writerUser.id, beforeIds, missing, afterIds:[...afterIds].sort(), applied:cfg.apply}));
} finally {
  if (setupResourceId) await request(`${adminBase}/clients/${setupResourceId}`, admin, 'DELETE');
}
