// Explicit single-controller/single-slot pilot enrolment. No generated device keys.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {X509Certificate} from 'node:crypto';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
const [certificate]=process.argv.slice(2);
const cert=new X509Certificate(fs.readFileSync(certificate));
const identity=cert.subject.match(/^CN=([A-Za-z0-9_-]{1,64})$/)?.[1];
if(!identity || Date.parse(cert.validTo)<Date.now())throw new Error('Invalid certificate identity/expiry');
const runtime=path.join(os.homedir(),'GrideX-runtime'), mqtt=path.join(runtime,'mqtt');
execFileSync('openssl',['verify','-purpose','sslclient','-CAfile',path.join(mqtt,'ca/ca.crt'),certificate],{stdio:'ignore'});
const output=execFileSync('docker',['--context','colima-gridex','exec','gridex-mac-gridex-db-1','psql','-U','gridex','-d','gridex','-Atc',
  "SELECT json_build_object('siteId',site_id,'gatewayId',id,'model',hardware_model,'role',role) FROM gateways"],{encoding:'utf8'});
const rows=output.trim().split('\n').map(JSON.parse);
const rock=rows.filter(r=>r.model==='rock-pi-e'&&r.role==='controller');
const esp=rows.filter(r=>r.model==='olimex-esp32-evb-lab'&&r.role==='device-node');
if(rock.length!==1||esp.length!==1||rock[0].siteId!==esp[0].siteId)throw new Error('Ambiguous pilot inventory');
const envPath=path.join(runtime,'backend/.env'), original=fs.readFileSync(envPath,'utf8');
const imported=parseEnv(fs.readFileSync(path.join(runtime,'backend/rockpie-import.env'),'utf8'));
if(!imported.GRIDEX_NODE_ENDPOINTS || imported.GRIDEX_NODE_ENDPOINTS.split(',').filter(Boolean).length!==1)throw new Error('Pilot requires exactly one verified slot');
const env=parseEnv(original);
const site=rock[0].siteId, gateway=rock[0].gatewayId;
const base=`gridex/v1/sites/${site}/edge/${gateway}`;
const aclPath=path.join(mqtt,'config/access.acl'), acl=fs.readFileSync(aclPath,'utf8');
if(acl.includes(`user ${identity}\n`))throw new Error('Identity already enrolled; inspect before changing');
const backup=fs.mkdtempSync(path.join(runtime,'private-backups/pilot-mqtt-'));fs.chmodSync(backup,0o700);
for(const [p,n] of [[envPath,'backend.env'],[aclPath,'access.acl'],[path.join(mqtt,'sites.json'),'sites.json']]){
 fs.copyFileSync(p,path.join(backup,n));fs.chmodSync(path.join(backup,n),0o600);
}
const reader=path.join(mqtt,'readers/heartbeat');fs.mkdirSync(reader,{recursive:true,mode:0o700});
for(const [src,name] of [[path.join(mqtt,'ca/ca.crt'),'ca.crt'],[path.join(mqtt,'clients/backend-reader/client.crt'),'client.crt'],[path.join(mqtt,'clients/backend-reader/client.key'),'client.key']]){
 fs.copyFileSync(src,path.join(reader,name));fs.chmodSync(path.join(reader,name),0o600);
}
const settings={GRIDEX_MQTT_URL:'mqtts://broker:8883',GRIDEX_MQTT_TOPIC_PREFIX:'gridex/v1',
 GRIDEX_HEARTBEAT_BINDINGS:JSON.stringify([{site,gateway,siteId:site,gatewayId:gateway,nodes:{'1':esp[0].gatewayId}}]),
 GRIDEX_MQTT_READER_DIRECTORY:reader,GRIDEX_MQTT_READER_UID:String(process.getuid()),GRIDEX_MQTT_READER_GID:String(process.getgid()),GRIDEX_MQTT_NETWORK:'gridex-mqtt_mqtt'};
let next=original;
for(const [k,v]of Object.entries(settings)){
 if(env[k]&&env[k]!==v)throw new Error('Existing incompatible setting: '+k);
 next=next.replace(new RegExp(`^${k}=.*(?:\\n|$)`,'gm'),'').trimEnd()+`\n${k}='${v}'\n`;
}
fs.writeFileSync(envPath+'.new',next,{mode:0o600});fs.renameSync(envPath+'.new',envPath);
const readerRules=`topic read ${base}/health\ntopic read ${base}/nodes/1/telemetry\n`;
if(!acl.includes('user backend-reader\n'))throw new Error('Missing reader ACL');
fs.writeFileSync(aclPath,acl.replace('user backend-reader\n','user backend-reader\n'+readerRules)+
 `\nuser ${identity}\ntopic write ${base}/health\ntopic write ${base}/nodes/1/telemetry\n`,{mode:0o600});
const inventoryPath=path.join(mqtt,'sites.json');
const inventory=JSON.parse(fs.readFileSync(inventoryPath,'utf8'));
inventory.push({identity,site,gateway,slots:[1]});
fs.writeFileSync(inventoryPath,JSON.stringify(inventory,null,2)+'\n',{mode:0o600});
const deviceSettings={GRIDEX_SITE_ID:site,GRIDEX_GATEWAY_ID:gateway,GRIDEX_MQTT_BROKER_URL:`mqtts://${env.GRIDEX_MQTT_PROXY_BIND}:8883`,
 GRIDEX_MQTT_TOPIC_PREFIX:'gridex/v1',GRIDEX_MQTT_CLIENT_ID:gateway,GRIDEX_MQTT_CA_FILE:'/etc/gridex/certs/mqtt-ca.crt',
 GRIDEX_MQTT_CLIENT_CERT_FILE:'/etc/gridex/certs/mqtt-client.crt',GRIDEX_MQTT_CLIENT_KEY_FILE:'/etc/gridex/certs/mqtt-client.key',
 GRIDEX_HEALTH_PUBLISH_SECONDS:'10',GRIDEX_NODE_TELEMETRY_PUBLISH_SECONDS:'2'};
const bundle=path.join(runtime,'backend/rock-mqtt-settings.json');
fs.writeFileSync(bundle,JSON.stringify(deviceSettings,null,2)+'\n',{mode:0o600});
console.log('Pilot ACL/bindings prepared; only health and slot 1 telemetry. Private settings bundle: '+bundle);
console.log('Rollback: '+backup);
