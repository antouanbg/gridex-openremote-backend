import fs from 'node:fs/promises';
import path from 'node:path';
import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
import {ApiError} from './errors.mjs';
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export function requireDeviceAdmin(site,principal) {
 if(site.membershipRole!=='administrator' || !principal.emailVerified) throw new ApiError(403,'permission_denied','Verified organisation administrator required.');
}
export function validateCredential(input) {
 if(input?.confirmed!==true || input.kind!=='ssh-key' || !Number.isInteger(input.expectedVersion) || input.expectedVersion<0
   || !/^[a-zA-Z0-9.-]{1,253}$/.test(input.host||'') || !/^[a-z_][a-z0-9_-]{0,31}$/i.test(input.username||'')
   || !Number.isInteger(input.port) || input.port<1 || input.port>65535
   || typeof input.privateKey!=='string' || input.privateKey.length>16384
   || !/^-----BEGIN (OPENSSH |RSA |EC |)PRIVATE KEY-----\r?\n/.test(input.privateKey)
   || !/^SHA256:[A-Za-z0-9+/]{43}$/.test(input.hostFingerprint||'')) throw new ApiError(400,'invalid_device_credential','Confirmed SSH key, pinned host fingerprint and valid connection fields required.');
 return {kind:'ssh-key',host:input.host,port:input.port,username:input.username,privateKey:input.privateKey,hostFingerprint:input.hostFingerprint};
}
// Private filesystem envelope store. Database/backups contain no connection secret.
// No HTTP operation exposes decrypt; a future approved worker must enforce scopes too.
export class DeviceVault {
 constructor(directory,keyFile){this.directory=directory;this.keyFile=keyFile;this.queue=Promise.resolve();}
 file(site,gateway){if(!uuid.test(site)||!uuid.test(gateway))throw new ApiError(400,'invalid_identifier','Invalid identifier');return path.join(this.directory,`${site}-${gateway}.json`);}
 async key(){const s=await fs.stat(this.keyFile);if((s.mode&0o077)!==0)throw new Error('Unsafe vault key permissions');const k=await fs.readFile(this.keyFile);if(k.length!==32)throw new Error('Invalid vault key');return k;}
 async envelope(site,gateway){try{return JSON.parse(await fs.readFile(this.file(site,gateway),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 async status(site,gateway){const e=await this.envelope(site,gateway);return {configured:!!e,version:e?.version||0,updatedAt:e?.updatedAt||null};}
 async store(site,gateway,input){
  const operation=this.queue.then(async()=>{
   const value=validateCredential(input),file=this.file(site,gateway);
   const previous=await this.status(site,gateway);
   if(previous.version!==input.expectedVersion)throw new ApiError(409,'credential_conflict','Credential version changed; reload before replacing.');
   const key=await this.key(),iv=randomBytes(12),version=previous.version+1,updatedAt=new Date().toISOString();
   const cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(`${site}:${gateway}:${version}:${updatedAt}`));
   const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
   await fs.mkdir(this.directory,{recursive:true,mode:0o700});
   if(((await fs.stat(this.directory)).mode&0o077)!==0)throw new Error('Unsafe vault directory permissions');
   const record={version,updatedAt,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};
   const temporary=file+'.'+randomBytes(8).toString('hex');
   await fs.writeFile(temporary,JSON.stringify(record),{mode:0o600,flag:'wx'});await fs.rename(temporary,file);
   return {configured:true,version,updatedAt};
  });this.queue=operation.catch(()=>{});return operation;
 }
 async readForWorker(site,gateway){const e=await this.envelope(site,gateway);if(!e)return null;const d=createDecipheriv('aes-256-gcm',await this.key(),Buffer.from(e.iv,'base64'));d.setAAD(Buffer.from(`${site}:${gateway}:${e.version}:${e.updatedAt}`));d.setAuthTag(Buffer.from(e.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data,'base64')),d.final()]).toString());}
}
