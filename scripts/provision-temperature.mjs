import fs from 'node:fs';import path from 'node:path';import{parseEnv}from'node:util';import{spawnSync}from'node:child_process';
const[envFile,backupRoot,email,apply]=process.argv.slice(2);
if(apply!=='--apply'||!email)throw Error('Usage PRIVATE_ENV PRIVATE_BACKUPS OWNER_EMAIL --apply');
const original=fs.readFileSync(envFile,'utf8'),env=parseEnv(original);
if(env.GRIDEX_HISTORY_BINDINGS)throw Error('History binding already configured; inspect before changing');
const backup=path.join(backupRoot,'temperature-provisioning-'+Date.now());fs.mkdirSync(backup,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(backup,'backend.env'),original,{mode:0o600});
const source=fs.readFileSync(new URL('./provision-temperature-inner.mjs',import.meta.url),'utf8');
const r=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD,email,bindings:JSON.parse(env.GRIDEX_HEARTBEAT_BINDINGS),prefix:env.GRIDEX_MQTT_TOPIC_PREFIX}),encoding:'utf8'});
fs.writeFileSync(path.join(backup,'result.json'),r.stdout,{mode:0o600});
if(r.status!==0){fs.writeFileSync(path.join(backup,'failure.log'),r.stderr,{mode:0o600});throw Error('Provisioning failed; private diagnostics: '+backup);}
const result=JSON.parse(r.stdout);
const values={GRIDEX_HISTORY_WRITER_CLIENT_ID:result.clientId,GRIDEX_HISTORY_WRITER_CLIENT_SECRET:result.secret,GRIDEX_HISTORY_BINDINGS:JSON.stringify(result.bindings)};
fs.writeFileSync(envFile,original+'\n'+Object.entries(values).map(([k,v])=>k+"='"+v+"'").join('\n')+'\n',{mode:0o600});fs.chmodSync(envFile,0o600);
console.log('Temperature asset and restricted writer configured for verified owner; no sensor values fabricated. Private rollback: '+backup);
