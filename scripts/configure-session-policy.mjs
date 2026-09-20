// One operator env, private rollback, no token/password output.
// Един операторски env, частен rollback, без отпечатване на токени/пароли.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const [envFile,backupDirectory,apply]=process.argv.slice(2);
if(!envFile||!backupDirectory||apply!=='--apply')throw Error('Usage: script PRIVATE_ENV PRIVATE_BACKUP_DIRECTORY --apply');
const original=fs.readFileSync(envFile,'utf8'),env=parseEnv(original);
const days=Number(env.GRIDEX_REMEMBER_SESSION_DAYS || 365);
if(!Number.isInteger(days)||days<1||days>365)throw Error('Remember session days must be 1..365');
const source=`
let input='';for await(const c of process.stdin)input+=c;
const cfg=JSON.parse(input),base='http://keycloak:8080/auth';
const response=await fetch(base+'/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({grant_type:'password',client_id:'admin-cli',username:'admin',password:cfg.password})});
if(!response.ok)throw Error('Admin authentication failed');
const token=await response.json(),headers={Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'};
const url=base+'/admin/realms/gridex';
const fields=['rememberMe','ssoSessionIdleTimeoutRememberMe','ssoSessionMaxLifespanRememberMe'];
if(cfg.values){const r=await fetch(url,{method:'PUT',headers,body:JSON.stringify(cfg.values)});if(!r.ok)throw Error('Session policy update failed');}
const r=await fetch(url,{headers});if(!r.ok)throw Error('Session policy read failed');
const realm=await r.json();console.log(JSON.stringify(Object.fromEntries(fields.map(k=>[k,realm[k]]))));
`;
function request(values){
  const r=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD,values}),encoding:'utf8'});
  if(r.status!==0)throw Error('Keycloak operation failed; credentials withheld');
  return JSON.parse(r.stdout);
}
const previous=request();
fs.mkdirSync(backupDirectory,{recursive:true,mode:0o700});
const backup=path.join(backupDirectory,`session-policy-${Date.now()}`);
fs.mkdirSync(backup,{mode:0o700});
fs.writeFileSync(path.join(backup,'backend.env'),original,{mode:0o600});
fs.writeFileSync(path.join(backup,'realm-session.json'),JSON.stringify(previous),{mode:0o600});
const desired={rememberMe:true,ssoSessionIdleTimeoutRememberMe:days*86400,ssoSessionMaxLifespanRememberMe:days*86400};
try {
  const result=request(desired);
  if(Object.keys(desired).some(k=>result[k]!==desired[k]))throw Error('Session verification failed');
  let text=original;
  for(const [key,value] of Object.entries({GRIDEX_REMEMBER_SESSION_DAYS:days,GRIDEX_REAUTH_ON_API_RESTART:'true'})){
    const pattern=new RegExp('^'+key+'=.*$','gm');
    if((text.match(pattern)||[]).length>1)throw Error('Duplicate configuration key');
    text=pattern.test(text)?text.replace(pattern,`${key}=${value}`):text+`\n${key}=${value}\n`;
  }
  fs.writeFileSync(envFile,text,{mode:0o600});fs.chmodSync(envFile,0o600);
  console.log('Remember Me enabled; configured days='+days+'. Restart gate requires API deployment. Private rollback: '+backup);
}catch(error){request(previous);fs.writeFileSync(envFile,original,{mode:0o600});throw error;}
