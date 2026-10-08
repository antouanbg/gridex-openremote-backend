// Owner-approved D4 read-only route repair; preserve all unrelated runtime configuration.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
const mode=process.argv[2];
if(!['--check','--apply'].includes(mode))throw Error('Use --check or --apply');
const proxy='gridex-public-https-public-proxy-1';
const run=args=>execFileSync('docker',args,{encoding:'utf8',timeout:30000});
const instance=JSON.parse(run(['inspect',proxy]))[0];
const file=instance.Mounts.find(item=>item.Destination==='/etc/nginx/nginx.conf')?.Source;
if(file!==path.join(os.homedir(),'GrideX-runtime/public-https-test/nginx.conf')||!instance.State.Running)throw Error('Unexpected proxy mount');
const before=fs.readFileSync(file,'utf8');
const template=fs.readFileSync(new URL('../deploy/public-https/nginx.conf.template',import.meta.url),'utf8');
const candidate=template.split('\n').find(line=>line.includes('realm/accessible$'));
const current=before.split('\n').filter(line=>line.includes('realm/accessible$'));
if(current.length!==1||!candidate?.includes('|alarm$|user/'))throw Error('Unexpected route baseline');
const old=candidate.replace('|alarm$|user/[a-z][a-z0-9-]{2,30}/userRealmRoles/[a-zA-Z0-9-]+$','');
if(current[0]!==old&&current[0]!==candidate)throw Error('Runtime route drift; do not overwrite');
const after=before.replace(current[0],candidate);
if(mode==='--check'){console.log('AUDIT_PROXY_DIFF_VALID: one read-only route line');process.exit(0);}
const dir=fs.mkdtempSync(path.join(os.homedir(),'GrideX-runtime/private-backups/audit-proxy-'));
fs.chmodSync(dir,0o700);
fs.writeFileSync(path.join(dir,'nginx.before.conf'),before,{mode:0o600});
if(fs.readFileSync(file,'utf8')!==before)throw Error('Concurrent proxy change');
try{
  // Preserve the bind-mounted inode. No other route or certificate is changed.
  fs.writeFileSync(file,after);
  run(['exec',proxy,'nginx','-t']);
  run(['exec',proxy,'nginx','-s','reload']);
  console.log('AUDIT_PROXY_RELOADED backup='+dir);
}catch(error){
  fs.writeFileSync(file,before);
  run(['exec',proxy,'nginx','-t']);run(['exec',proxy,'nginx','-s','reload']);
  throw error;
}
