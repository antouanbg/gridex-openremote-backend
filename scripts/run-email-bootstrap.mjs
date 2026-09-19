// Private local operator entry point. Never prints credentials or action links.
import fs from 'node:fs';
import { parseEnv } from 'node:util';
import { spawnSync } from 'node:child_process';
const [file,ownerEmail,organizationName] = process.argv.slice(2);
if(!file || !ownerEmail || !organizationName) throw new Error('Usage: script /private/backend/.env owner@example.com Organization');
const env=parseEnv(fs.readFileSync(file,'utf8'));
const source=fs.readFileSync(new URL('./bootstrap-email-organization.mjs',import.meta.url),'utf8');
const result=spawnSync('docker',['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source],{
 input:JSON.stringify({ownerEmail,organizationName,adminPassword:env.OR_ADMIN_PASSWORD,enrollmentSecret:env.GRIDEX_ENROLLMENT_CLIENT_SECRET,portalOrigin:env.GRIDEX_PORTAL_ORIGIN}),
 encoding:'utf8',maxBuffer:1024*1024,
});
process.stdout.write(result.stdout||''); process.stderr.write(result.stderr||'');
process.exitCode=result.status??1;
