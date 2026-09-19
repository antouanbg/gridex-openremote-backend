// Execute as root in a one-shot container mounting separate empty vault volumes.
// Never overwrite a master key, never print it, never put it in the SQL backup.
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
const directory='/var/lib/gridex-device-vault',keys='/run/gridex-device-vault',key=keys+'/master.key';
if(!fs.existsSync(key)&&fs.readdirSync(directory).length)throw new Error('Existing ciphertext without key: restore key, do not generate replacement');
if(!fs.existsSync(key))fs.writeFileSync(key,randomBytes(32),{mode:0o400,flag:'wx'});
if(fs.statSync(key).size!==32)throw new Error('Invalid master key');
for(const p of [directory,keys]){fs.chownSync(p,1000,1000);fs.chmodSync(p,0o700);}
fs.chownSync(key,1000,1000);fs.chmodSync(key,0o400);
console.log('Vault initialized; master key never printed. Separate encrypted key backup still required.');
