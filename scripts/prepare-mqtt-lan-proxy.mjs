// Mac-only installation preparation; no routes, router, client keys or ACL changes.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {configuration} from './mqtt-tcp-proxy.mjs';

const [bind, sources] = process.argv.slice(2);
configuration({GRIDEX_MQTT_PROXY_BIND:bind,GRIDEX_MQTT_PROXY_ALLOWED_IPS:sources});
if (process.platform !== 'darwin') throw new Error('Mac deployment only');
const runtime=path.join(os.homedir(),'GrideX-runtime');
const env=path.join(runtime,'backend/.env');
const mqtt=path.join(runtime,'mqtt');
const original=fs.readFileSync(env,'utf8');
if (fs.statSync(env).mode & 0o077) throw new Error('Private env permissions required');
const backup=fs.mkdtempSync(path.join(runtime,'private-backups/mqtt-lan-'));
fs.chmodSync(backup,0o700);
for (const [from,to] of [[env,'backend.env'],[path.join(mqtt,'server/server.crt'),'server.crt']]) {
  fs.copyFileSync(from,path.join(backup,to)); fs.chmodSync(path.join(backup,to),0o600);
}
function openssl(args) {
  const result=spawnSync('openssl',args,{stdio:'ignore'});
  if(result.status!==0) throw new Error('Certificate preparation failed; original certificate unchanged');
}
const work=fs.mkdtempSync(path.join(os.tmpdir(),'gridex-mqtt-cert-'));
fs.chmodSync(work,0o700);
const crt=path.join(work,'server.crt'), csr=path.join(work,'server.csr'), ext=path.join(work,'server.ext');
try {
  fs.writeFileSync(ext,`basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost,DNS:broker,IP:127.0.0.1,IP:${bind}\n`,{mode:0o600});
  openssl(['req','-new','-key',path.join(mqtt,'server/server.key'),'-subj','/CN=broker','-out',csr]);
  openssl(['x509','-req','-in',csr,'-CA',path.join(mqtt,'ca/ca.crt'),'-CAkey',path.join(mqtt,'ca/ca.key'),
    '-set_serial','0x'+crypto.randomBytes(16).toString('hex'),'-days','90','-sha256','-extfile',ext,'-out',crt]);
  openssl(['verify','-CAfile',path.join(mqtt,'ca/ca.crt'),crt]);
  const parsed=new crypto.X509Certificate(fs.readFileSync(crt));
  if (!parsed.checkIP(bind) || !parsed.checkHost('localhost') || !parsed.checkPrivateKey(crypto.createPrivateKey(fs.readFileSync(path.join(mqtt,'server/server.key'))))) throw new Error('Server certificate validation failed');
  let next=original;
  for(const [key,value] of Object.entries({GRIDEX_MQTT_PROXY_BIND:bind,GRIDEX_MQTT_PROXY_ALLOWED_IPS:sources})) {
    next=next.replace(new RegExp(`^${key}=.*(?:\\n|$)`,'gm'),'');
    next=next.trimEnd()+`\n${key}=${value}\n`;
  }
  fs.writeFileSync(env+'.mqtt-new',next,{mode:0o600}); fs.renameSync(env+'.mqtt-new',env);
  fs.copyFileSync(crt,path.join(mqtt,'server/server.crt.new')); fs.chmodSync(path.join(mqtt,'server/server.crt.new'),0o600);
  fs.renameSync(path.join(mqtt,'server/server.crt.new'),path.join(mqtt,'server/server.crt'));
} finally { for(const f of [crt,csr,ext]) if(fs.existsSync(f))fs.unlinkSync(f); fs.rmdirSync(work); }
const relayDir=path.join(runtime,'mqtt-proxy'); fs.mkdirSync(relayDir,{recursive:true,mode:0o700});
const script=path.join(relayDir,'mqtt-tcp-proxy.mjs');
fs.copyFileSync(fileURLToPath(new URL('./mqtt-tcp-proxy.mjs',import.meta.url)),script); fs.chmodSync(script,0o600);
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const plist=path.join(os.homedir(),'Library/LaunchAgents/tech.gridex.mqtt-lan-proxy.plist');
if(fs.existsSync(plist))fs.copyFileSync(plist,path.join(backup,'launchagent.plist'));
fs.writeFileSync(plist,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>tech.gridex.mqtt-lan-proxy</string>
<key>ProgramArguments</key><array>${[process.execPath,script,env].map(x=>'<string>'+xml(x)+'</string>').join('')}</array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${xml(path.join(relayDir,'relay.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(relayDir,'relay-error.log'))}</string>
</dict></plist>\n`,{mode:0o600});
console.log('Prepared relay and server LAN SAN; existing CA/client keys/ACL unchanged. Reload broker and bootstrap LaunchAgent next.');
console.log('Private rollback directory: '+backup);
