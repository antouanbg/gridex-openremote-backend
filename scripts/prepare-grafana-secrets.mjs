#!/usr/bin/env node
// One-time private activation helper. Never prints credentials.
import { randomBytes } from 'node:crypto';
import { copyFileSync, lstatSync, readFileSync, renameSync, chmodSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const file=process.argv[2];
if(!file || !file.endsWith('/GrideX-runtime/backend/.env'))
  throw new Error('Pass the exact private GrideX backend .env path.');
const stat=lstatSync(file);
if(!stat.isFile() || stat.isSymbolicLink())throw new Error('Private env must be a regular file.');
const original=readFileSync(file,'utf8');
const key=(name)=>{
  const matches=[...original.matchAll(new RegExp(`^${name}=(.*)$`,'gm'))];
  if(matches.length>1)throw new Error(`Duplicate ${name} in private env.`);
  if(!matches.length)return null;
  const raw=matches[0][1].trim();
  const value=raw.startsWith("'")&&raw.endsWith("'")?raw.slice(1,-1):raw;
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(value))throw new Error(`Invalid ${name} format.`);
  return value;
};
const admin=key('GRIDEX_GRAFANA_ADMIN_PASSWORD')||randomBytes(40).toString('hex');
const reader=key('GRIDEX_GRAFANA_MARKET_READER_PASSWORD')||randomBytes(40).toString('hex');
const next=original.replace(/\s*$/,'\n')
  +(key('GRIDEX_GRAFANA_ADMIN_PASSWORD')?'':`GRIDEX_GRAFANA_ADMIN_PASSWORD='${admin}'\n`)
  +(key('GRIDEX_GRAFANA_MARKET_READER_PASSWORD')?'':`GRIDEX_GRAFANA_MARKET_READER_PASSWORD='${reader}'\n`);
if(next!==original){
  const backup=`${file}.before-grafana-20260929`;
  copyFileSync(file,backup);chmodSync(backup,0o600);
  const temp=`${file}.grafana-tmp-${process.pid}`;
  writeFileSync(temp,next,{flag:'wx',mode:0o600});
  renameSync(temp,file);chmodSync(file,0o600);
}
const sql=`ALTER ROLE gridex_grafana_market_ro LOGIN PASSWORD '${reader}';\n`;
const applied=spawnSync('docker',['exec','-i','gridex-mac-gridex-market-db-1',
  'psql','-v','ON_ERROR_STOP=1','-U','gridex_market','-d','gridex_market','-f','/dev/stdin'],
{input:sql,encoding:'utf8'});
if(applied.status!==0)throw new Error('Grafana reader role activation failed.');
process.stdout.write('GRAFANA_PRIVATE_CREDENTIALS_READY (values not printed)\n');
