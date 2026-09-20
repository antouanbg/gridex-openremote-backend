import fs from'node:fs';import{parseEnv}from'node:util';import{spawnSync}from'node:child_process';
const env=parseEnv(fs.readFileSync(process.argv[2],'utf8'));
const source=fs.readFileSync(new URL('./check-history-write-inner.mjs',import.meta.url),'utf8');
const r=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{input:JSON.stringify({password:env.OR_ADMIN_PASSWORD,dbPassword:env.OR_DATABASE_PASSWORD,writerId:env.GRIDEX_HISTORY_WRITER_CLIENT_ID,writerSecret:env.GRIDEX_HISTORY_WRITER_CLIENT_SECRET}),encoding:'utf8',timeout:60000});
if(r.status!==0){console.error(r.stderr.split('\n').filter(x=>x.startsWith('Error:')).join('\n'));throw Error('History acceptance probe failed');}
process.stdout.write(r.stdout);
