import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const env=parseEnv(fs.readFileSync(process.argv[2],'utf8'));
const source=`
let input='';for await(const chunk of process.stdin)input+=chunk;
const cfg=JSON.parse(input),base='http://keycloak:8080/auth';
async function token(client){const r=await fetch(base+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:client,username:'admin',password:cfg.password})});return r.ok?(await r.json()).access_token:null;}
const admin=await token('admin-cli');if(!admin)throw Error('Admin authentication failed');
const kcHeaders={Authorization:'Bearer '+admin};
const clients=await(await fetch(base+'/admin/realms/master/clients?clientId=openremote',{headers:kcHeaders})).json();
console.log(JSON.stringify({masterOpenremoteClients:clients.map(c=>({publicClient:c.publicClient,directAccessGrantsEnabled:c.directAccessGrantsEnabled}))}));
for(const client of ['admin-cli','openremote']){
const t=client==='admin-cli'?admin:await token(client);if(!t){console.log(client+' token unavailable');continue;}
const r=await fetch('http://manager:8080/api/master/asset/query',{method:'POST',headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'},body:'{}'});
if(r.ok){const a=await r.json();console.log(JSON.stringify({client,status:r.status,assets:a.map(x=>({type:x.type,realm:x.realm}))}));}else console.log(JSON.stringify({client,status:r.status}));
}
`;
const result=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD}),encoding:'utf8'});
if(result.status!==0)throw Error('Capability inspection failed; sensitive output withheld');
process.stdout.write(result.stdout);
