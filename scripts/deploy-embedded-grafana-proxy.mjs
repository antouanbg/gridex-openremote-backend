#!/usr/bin/env node
// Add only the reviewed Grafana locations to the currently mounted proxy.
// Preserve Manager, OIDC and Docusaurus routes byte for byte.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode=process.argv[2];
if(!['--inspect','--apply'].includes(mode))throw new Error('Use --inspect or --apply.');
const root=fileURLToPath(new URL('..',import.meta.url));
const name='gridex-public-https-public-proxy-1';
const inspect=spawnSync('docker',['inspect',name],{encoding:'utf8'});
if(inspect.status!==0)throw new Error('Live proxy inspection failed.');
const live=JSON.parse(inspect.stdout)[0];
const mount=live.Mounts.find(item=>item.Destination==='/etc/nginx/nginx.conf');
const certs=live.Mounts.find(item=>item.Destination==='/certs')?.Source;
if(!live.State.Running || !mount?.Source?.endsWith('/nginx.conf') || !certs || !live.Config.Image.startsWith('nginx@sha256:'))
  throw new Error('Unexpected live proxy container or mounts.');
const before=fs.readFileSync(mount.Source,'utf8');
const template=fs.readFileSync(path.join(root,'deploy/public-https/nginx.conf.template'),'utf8')
  .replaceAll('${API_HOST}','api.gridex.tech').replaceAll('${AUTH_HOST}','auth.gridex.tech');
const startMark='        # BEGIN GRIDEX EMBEDDED GRAFANA';
const endMark='        # END GRIDEX EMBEDDED GRAFANA';
const start=template.indexOf(startMark),end=template.indexOf(endMark,start);
if(start<0||end<0||template.indexOf(startMark,start+1)>=0)throw new Error('Grafana markers missing or repeated.');
const block=template.slice(start,end+endMark.length);
if(before.includes(startMark)){
  if(before.includes(block)){process.stdout.write('GRAFANA_PROXY_ALREADY_INSTALLED\n');process.exit(0);}
  throw new Error('Live Grafana route differs; refusing overwrite.');
}
if(!before.includes('# BEGIN GRIDEX PUBLIC DOCS')||!before.includes('# BEGIN GRIDEX PUBLIC MANAGER')
  || !before.includes('server_name api.gridex.tech;'))throw new Error('Existing proxy routes do not match expected protections.');
const anchor='        location /api/v1/ {\n            proxy_pass http://$api_backend;\n        }';
const at=before.indexOf(anchor);
if(at<0||before.indexOf(anchor,at+1)>=0)throw new Error('API anchor missing or repeated.');
const insert=at+anchor.length;
const candidate=before.slice(0,insert)+'\n'+block+before.slice(insert);
if(candidate.replace('\n'+block,'')!==before)throw new Error('Unrelated proxy change detected.');
// Colima shares the project checkout, but not macOS's per-user /var/folders.
const temporary=fs.mkdtempSync(path.join(root,'nginx-grafana-check.'));
try{
  const file=path.join(temporary,'nginx.conf');
  fs.writeFileSync(file,candidate,{mode:0o600});
  const test=spawnSync('docker',['run','--rm','--entrypoint','nginx','-v',`${file}:/etc/nginx/nginx.conf:ro`,
    '-v',`${certs}:/certs:ro`,live.Config.Image,'-t'],{encoding:'utf8',timeout:30000});
  if(test.status!==0)throw new Error(`Nginx syntax test failed: ${test.stderr?.slice(-700)}`);
  if(mode==='--inspect')process.stdout.write('GRAFANA_PROXY_READY_TO_APPLY\n');
  else {
    const backup=path.join(os.homedir(),'GrideX-runtime/private-backups/public-proxy-before-grafana-20260929.conf');
    fs.writeFileSync(backup,before,{mode:0o600});
    // The bind mount follows the inode: update contents in place, not rename.
    fs.writeFileSync(mount.Source,candidate);
    process.stdout.write(`GRAFANA_PROXY_CONFIG_APPLIED backup=${backup}\n`);
  }
}finally{fs.rmSync(temporary,{recursive:true,force:true});}
