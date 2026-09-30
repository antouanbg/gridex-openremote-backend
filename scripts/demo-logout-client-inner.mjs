// Runs inside the private API container. All input/output stays with the
// operator wrapper; never print the client snapshot to a terminal or Git.
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(0,'utf8'));
const kc='http://keycloak:8080/auth';
async function request(path, options={}) {
  const response=await fetch(kc+path,{...options,signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error(`Keycloak HTTP ${response.status}`);
  const body=await response.text();
  return body?JSON.parse(body):null;
}
const token=await request('/realms/master/protocol/openid-connect/token',{
  method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.adminPassword}),
});
const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const clients=await request('/admin/realms/gridex/clients?clientId=gridex-portal',{headers});
if(clients.length!==1)throw Error('Expected one platform portal client');
const path=`/admin/realms/gridex/clients/${clients[0].id}`;
const before=await request(path,{headers});
if(!before.enabled||!before.publicClient||!before.redirectUris?.some(uri=>uri===`${cfg.portalOrigin}/`||uri===`${cfg.portalOrigin}/*`))
  throw Error('Unexpected portal client configuration');
const callback=`${cfg.portalOrigin}/demo/`;
const redirects=(before.attributes?.['post.logout.redirect.uris']||'').split('##').filter(Boolean);
if(cfg.mode==='inspect') {
  process.stdout.write(JSON.stringify({client:before,allowed:redirects.includes(callback)}));
} else if(cfg.mode==='apply') {
  if(before.id!==cfg.expectedId||before.attributes?.['post.logout.redirect.uris']!==cfg.expectedAttribute)
    throw Error('Portal client changed after backup');
  const next={...before,attributes:{...before.attributes,
    'post.logout.redirect.uris':[...new Set([...redirects,callback])].join('##')}};
  await request(path,{headers,method:'PUT',body:JSON.stringify(next)});
  const actual=await request(path,{headers});
  if(!(actual.attributes?.['post.logout.redirect.uris']||'').split('##').includes(callback)) {
    await request(path,{headers,method:'PUT',body:JSON.stringify(before)});
    throw Error('Demo logout callback not confirmed; original client restored');
  }
  process.stdout.write(JSON.stringify({allowed:true}));
} else throw Error('Unknown mode');
