// Ephemeral unprivileged identity/client; no email and no access to Site data.
// Временна самоличност/клиент без права, имейл или достъп до Обекти.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const env=parseEnv(fs.readFileSync(process.argv[2],'utf8'));
const source=`
let input='';for await(const c of process.stdin)input+=c;
const cfg=JSON.parse(input),base='http://keycloak:8080/auth';
async function request(path,options={}){const r=await fetch(base+path,options);if(!r.ok){const error=await r.json().catch(()=>({}));console.log(JSON.stringify({probeStatus:r.status,error:error.error,description:error.error_description}));throw Error('Probe HTTP '+r.status);}const body=await r.text();return body?JSON.parse(body):null;}
const admin=await request('/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password})});
const headers={Authorization:'Bearer '+admin.access_token,'Content-Type':'application/json'};
const name='gridex-session-probe-'+crypto.randomUUID(),password=crypto.randomUUID()+crypto.randomUUID();
const portal=(await request('/admin/realms/gridex/clients?clientId=gridex-portal',{headers}))[0];
const portalScopes=await request('/admin/realms/gridex/clients/'+portal.id+'/default-client-scopes',{headers});
let uid,cid;
try{
 await request('/admin/realms/gridex/clients',{method:'POST',headers,body:JSON.stringify({clientId:name,publicClient:true,directAccessGrantsEnabled:false,standardFlowEnabled:true,defaultClientScopes:portalScopes.map(scope=>scope.name),redirectUris:['https://example.invalid/callback']})});
 cid=(await request('/admin/realms/gridex/clients?clientId='+name,{headers}))[0].id;
 await request('/admin/realms/gridex/users',{method:'POST',headers,body:JSON.stringify({username:name,enabled:true,emailVerified:true,firstName:'Session',lastName:'Probe',email:name+'@example.invalid',credentials:[{type:'password',value:password,temporary:false}]})});
 uid=(await request('/admin/realms/gridex/users?username='+name,{headers}))[0].id;
 const verifier=crypto.randomUUID()+crypto.randomUUID();
 const challenge=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');
 const params=new URLSearchParams({client_id:name,redirect_uri:'https://example.invalid/callback',response_type:'code',scope:'openid',code_challenge_method:'S256',code_challenge:challenge});
 const form=await fetch(base+'/realms/gridex/protocol/openid-connect/auth?'+params,{redirect:'manual'});
 const html=await form.text();
 const action=html.match(/<form[^>]*action="([^"]+)"/i)?.[1]?.replaceAll('&amp;','&');
 if(!action)throw Error('Login form missing');
 const cookies=form.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ');
 const actionUrl=new URL(action);
 const login=await fetch('http://keycloak:8080'+actionUrl.pathname+actionUrl.search,{method:'POST',redirect:'manual',headers:{Cookie:cookies},body:new URLSearchParams({username:name+'@example.invalid',password,credentialId:''})});
 const location=login.headers.get('location');
 if(!location)throw Error('Login did not return authorization code');
 const code=new URL(location).searchParams.get('code');
 if(!code)throw Error('Authorization code missing');
 const token=await request('/realms/gridex/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:name,grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:'https://example.invalid/callback'})});
 const claims=JSON.parse(Buffer.from(token.access_token.split('.')[1],'base64url'));
 console.log(JSON.stringify({accessTokenHasAuthTime:Number.isFinite(claims.auth_time),authTimeIsRecent:Math.abs(Date.now()/1000-claims.auth_time)<30}));
 if(!Number.isFinite(claims.auth_time))process.exitCode=1;
}finally{
 if(uid)await request('/admin/realms/gridex/users/'+uid,{method:'DELETE',headers});
 if(cid)await request('/admin/realms/gridex/clients/'+cid,{method:'DELETE',headers});
 console.log('Temporary probe identity and client removed');
}
`;
const r=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD}),encoding:'utf8'});
console.log(r.stdout);if(r.status!==0)console.error('Session claim probe failed; no credentials printed');process.exitCode=r.status;
