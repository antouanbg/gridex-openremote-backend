import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {DeviceVault,requireDeviceAdmin,validateCredential} from '../src/device-vault.mjs';
import {createServer} from 'node:http';
import {createApp} from '../src/app.mjs';
import {MemoryRepository} from '../src/repository.mjs';
test('vault encrypts full connection, binds ciphertext to gateway, hides values and rejects stale replacement',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'gridex-vault-test-'));
 try{const key=path.join(root,'key');await fs.writeFile(key,randomBytes(32),{mode:0o600});
 const vault=new DeviceVault(path.join(root,'data'),key),site=randomUUID(),gateway=randomUUID();
 const input={kind:'ssh-key',host:'private.example',port:22,username:'gridex',privateKey:'-----BEGIN PRIVATE KEY-----\nsynthetic-test-only\n-----END PRIVATE KEY-----',hostFingerprint:'SHA256:'+'A'.repeat(43),confirmed:true,expectedVersion:0};
 assert.equal((await vault.store(site,gateway,input)).version,1);
 const stored=await fs.readFile(vault.file(site,gateway),'utf8');assert.ok(!stored.includes('private.example'));assert.ok(!stored.includes('synthetic'));
 assert.deepEqual(Object.keys(await vault.status(site,gateway)).sort(),['configured','updatedAt','version']);
 assert.equal((await vault.readForWorker(site,gateway)).host,input.host);
 await assert.rejects(vault.store(site,gateway,input),e=>e.status===409);
 const other=randomUUID();await fs.copyFile(vault.file(site,gateway),vault.file(site,other));await assert.rejects(vault.readForWorker(site,other));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('device administration requires current site administrator and verified email',()=>{
 for(const role of ['viewer','operator','integrator','energy_manager'])assert.throws(()=>requireDeviceAdmin({membershipRole:role},{emailVerified:true}),e=>e.status===403);
 assert.throws(()=>requireDeviceAdmin({membershipRole:'administrator'},{emailVerified:false}));
 assert.doesNotThrow(()=>requireDeviceAdmin({membershipRole:'administrator'},{emailVerified:true}));
 assert.throws(()=>validateCredential({confirmed:false}));
});
test('HTTP vault route rejects foreign sites, non-admins and direct ESP access; GET exposes metadata only',async()=>{
 const site=randomUUID(),other=randomUUID(),gateway=randomUUID(),node=randomUUID();
 const repository=new MemoryRepository({sites:[{id:site,organisationId:'org'},{id:other,organisationId:'other'}],memberships:[{subject:'owner',organisationId:'org',role:'administrator',allSites:true}]});
 repository.getTopology=async()=>({gateways:[{id:gateway,role:'controller'},{id:node,role:'device-node'}]});
 const server=createServer(createApp({repository,authenticate:async()=>({subject:'owner',emailVerified:true}),config:{allowedOrigins:new Set()},openRemote:{},deviceVault:{status:async()=>({configured:true,version:1,updatedAt:null})}}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/api/v1/sites`;
 try{assert.equal((await fetch(`${base}/${other}/gateways/${gateway}/access`)).status,404);
 assert.equal((await fetch(`${base}/${site}/gateways/${node}/access`)).status,400);
 const response=await fetch(`${base}/${site}/gateways/${gateway}/access`);assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{configured:true,version:1,updatedAt:null});
 repository.memberships[0].role='viewer';assert.equal((await fetch(`${base}/${site}/gateways/${gateway}/access`)).status,403);
 }finally{await new Promise(r=>server.close(r));}
});
