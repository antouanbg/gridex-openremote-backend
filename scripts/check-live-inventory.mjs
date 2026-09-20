// Read-only real DB/OR/HTTP-handler probe; NOT proof of an owner's browser login.
import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const snapshot=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const source=`import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRepository} from './src/repository.mjs';import {loadConfig} from './src/config.mjs';
import {OpenRemoteClient} from './src/openremote-client.mjs';import {createApp} from './src/app.mjs';
let text='';for await(const c of process.stdin)text+=c;const input=JSON.parse(text);
const config=loadConfig(),repository=createRepository(config),openRemote=new OpenRemoteClient(config);
const identity={subject:input.subject,emailVerified:true};
const server=createServer(createApp({config,repository,openRemote,authenticate:async()=>identity}));
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const url='http://127.0.0.1:'+server.address().port+'/api/v1';
 const sr=await fetch(url+'/sites');assert.equal(sr.status,200);const sites=(await sr.json()).sites;
 assert.ok(sites.some(s=>s.id===input.siteId));
 const r=await fetch(url+'/sites/'+input.siteId+'/hardware');assert.equal(r.status,200);const body=await r.json();
 assert.equal(body.inventorySource,'openremote');assert.equal(body.gateways.length,2);
 assert.ok(body.gateways.every(g=>g.provisioningStatus==='verified'));
 assert.equal(new Set(body.gateways.map(g=>g.id)).size,2);
 assert.equal(body.gateways.filter(g=>g.role==='controller').length,1);
 assert.equal(body.gateways.filter(g=>g.role==='device-node').length,1);
 console.log(JSON.stringify({siteVisible:true,gateways:body.gateways.length,source:body.inventorySource,scope:'real-owner-membership and OR links; injected identity, no browser login'}));
}finally{await new Promise(r=>server.close(r));await repository.close();}`;
const r=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({subject:snapshot.owner.id,siteId:snapshot.site.id}),encoding:'utf8'});
if(r.status!==0){console.error(r.stderr);process.exitCode=1;}else console.log(r.stdout.trim());
