// Private stdin; stdout contains the rollback snapshot and must remain private.
import fs from 'node:fs';
const cfg=JSON.parse(fs.readFileSync(0,'utf8'));
const kc='http://keycloak:8080/auth';
async function req(p,options={}) {
 const r=await fetch(kc+p,{...options,signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Keycloak request failed '+r.status);
 const body=await r.text(); return body?JSON.parse(body):null;
}
const token=await req('/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password})});
const headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
const clients=await req('/admin/realms/gridex/clients?clientId=openremote',{headers});
if(clients.length!==1)throw Error('Expected one existing Manager client');
const path='/admin/realms/gridex/clients/'+clients[0].id;
const before=await req(path,{headers});
if(!before.publicClient||!before.standardFlowEnabled)throw Error('Expected existing public browser client');
if(cfg.restore){
 if(cfg.restore.id!==before.id)throw Error('Rollback client mismatch');
 await req(path,{headers,method:'PUT',body:JSON.stringify(cfg.restore)});
}else if(cfg.apply){
 const callback=cfg.origin+'/manager/*';
 const next={...before,redirectUris:[...new Set([...(before.redirectUris||[]),callback])],webOrigins:[...new Set([...(before.webOrigins||[]),cfg.origin])],attributes:{...before.attributes,'post.logout.redirect.uris':[...new Set([...(before.attributes?.['post.logout.redirect.uris']||'').split('##').filter(Boolean),callback])].join('##')}};
 await req(path,{headers,method:'PUT',body:JSON.stringify(next)});
 const after=await req(path,{headers});
 if(!after.redirectUris.includes(callback)||!after.webOrigins.includes(cfg.origin))throw Error('Client verification failed');
}
console.log(JSON.stringify(before));
