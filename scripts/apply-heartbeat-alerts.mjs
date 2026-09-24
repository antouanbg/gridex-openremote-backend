// Additive alert-state migration; private backup before any change.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const container='gridex-mac-gridex-db-1';
const docker=['--context','colima-gridex'];
const base=path.join(os.homedir(),'GrideX-runtime/private-backups');
fs.mkdirSync(base,{recursive:true,mode:0o700});
const backup=fs.mkdtempSync(path.join(base,'heartbeat-alerts-'));
fs.chmodSync(backup,0o700);
const dump=path.join(backup,'gridex.dump');
const fd=fs.openSync(dump,'wx',0o600);
let result;
try{result=spawnSync('docker',[...docker,'exec',container,'pg_dump','-U','gridex','-d','gridex','-Fc'],{stdio:['ignore',fd,'pipe']});}
finally{fs.closeSync(fd);}
if(result.status!==0||!fs.statSync(dump).size)throw new Error('Backup failed; migration not run');
const listing=spawnSync('docker',[...docker,'exec','-i',container,'pg_restore','--list'],{input:fs.readFileSync(dump),encoding:'utf8'});
if(listing.status!==0||!listing.stdout.includes('TABLE'))throw new Error('Backup validation failed');
const sql=fs.readFileSync(new URL('../services/gridex-api/migrations/010_heartbeat_alerts.sql',import.meta.url));
result=spawnSync('docker',[...docker,'exec','-i',container,'psql','-U','gridex','-d','gridex','-v','ON_ERROR_STOP=1'],{input:sql,encoding:'utf8'});
if(result.status!==0)throw new Error('Migration failed; backup retained');
const check=spawnSync('docker',[...docker,'exec',container,'psql','-U','gridex','-d','gridex','-Atc',
  "SELECT count(*) FROM information_schema.columns WHERE table_name='heartbeat_alerts'"],{encoding:'utf8'});
if(check.status!==0||check.stdout.trim()!=='8')throw new Error('Schema verification failed');
console.log('Migration 010 verified; backup: '+dump);
