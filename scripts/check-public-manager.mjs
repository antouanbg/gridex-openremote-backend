// Read-only gate. --local verifies ingress, never proves external reachability.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const [envFile,mode]=process.argv.slice(2);
if(mode && mode!=='--local')throw Error('Usage PRIVATE_ENV [--local]');
const env=parseEnv(fs.readFileSync(envFile,'utf8'));
const origin=new URL(env.GRIDEX_PUBLIC_AUTH_BASE).origin;
const hostname=new URL(origin).hostname;
let failed=false;
function get(p){
 const r=spawnSync('curl',['--silent','--show-error','--max-time','8',...(mode==='--local'?['--connect-to',hostname+':443:127.0.0.1:14443']:[]),'--write-out','\n%{http_code}',origin+p],{encoding:'utf8'});
 if(r.status!==0)throw Error('Connection/TLS failed');
 const n=r.stdout.lastIndexOf('\n');return{body:r.stdout.slice(0,n),status:Number(r.stdout.slice(n+1))};
}
function check(label,fn){try{if(!fn())throw Error('Unexpected response');console.log('PASS '+label);}catch{failed=true;console.log('FAIL '+label);}}
console.log(mode==='--local'?'FORCED LOCAL INGRESS ONLY; trusted TLS; pilot relay port 14443':'NORMAL DNS; trusted TLS; caller network only');
check('Manager HTML',()=>get('/manager/?realm=gridex').body.includes('WebComponentsReady'));
check('synthetic gridex bootstrap',()=>{const r=get('/api/master/configuration/manager');return r.status===200&&JSON.parse(r.body).manager.realm==='gridex';});
check('public issuer',()=>JSON.parse(get('/auth/realms/gridex/.well-known/openid-configuration').body).issuer===origin+'/auth/realms/gridex');
for(const p of ['/api/master/asset/query','/api/master/user/user','/auth/admin/','/auth/realms/master/.well-known/openid-configuration','/health','/metrics','/api/gridex/user/query','/api/gridex/realm'])check('deny '+p,()=>get(p).status===404);
check('anonymous user data denied',()=>[401,403].includes(get('/api/gridex/user/user').status));
check('WebSocket missing Origin denied',()=>get('/websocket/events').status===403);
check('Manager callback login form',()=>{const q=new URLSearchParams({client_id:'openremote',redirect_uri:origin+'/manager/?realm=gridex',response_type:'code',scope:'openid',code_challenge:'a'.repeat(43),code_challenge_method:'S256'});const r=get('/auth/realms/gridex/protocol/openid-connect/auth?'+q);return r.status===200&&r.body.includes('name="password"')&&!r.body.includes('Invalid parameter');});
process.exitCode=failed?1:0;
