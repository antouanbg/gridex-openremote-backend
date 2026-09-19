// Operator-authorized metadata import only. No SSH or hardware writes.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const [file, organizationName, siteName] = process.argv.slice(2);
if (!file || !organizationName || !siteName) throw new Error('Usage: script PRIVATE_EXPORT ORGANIZATION SITE');
if ((fs.statSync(file).mode & 0o077) !== 0) throw new Error('Export must be private (0600)');
const source = `
import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {randomUUID,randomBytes,createCipheriv,createHash} from 'node:crypto';
import pg from 'pg';
let raw='';for await(const chunk of process.stdin)raw+=chunk;
const input=JSON.parse(raw),env=parseEnv(input.content);
const hash=createHash('sha256').update(input.content).digest('hex');
if(!env.GRIDEX_NODE_ENDPOINTS||!env.GRIDEX_OT_DHCP_RESERVATIONS)throw new Error('Missing node/DHCP configuration');
const pollMs=Number(env.GRIDEX_NODE_POLL_MS),timeoutMs=Number(env.GRIDEX_NODE_TIMEOUT_MS);
if(!Number.isInteger(pollMs)||pollMs<=0||!Number.isInteger(timeoutMs)||timeoutMs<=0)throw new Error('Invalid polling settings');
const approvalKeys=['GRIDEX_APPROVE_ADDRESSING','GRIDEX_APPROVE_INT32_WORD_ORDER','GRIDEX_APPROVE_POWER_SIGN','GRIDEX_APPROVE_SCALING'];
if(approvalKeys.some(k=>env[k]!=='0'))throw new Error('Expected locked test commissioning');
const db=new pg.Client();await db.connect();
try {
 await db.query('BEGIN');
 const sites=await db.query('SELECT s.id,s.organisation_id FROM sites s JOIN organisations o ON o.id=s.organisation_id WHERE s.name=$1 AND o.name=$2',[input.siteName,input.organizationName]);
 if(sites.rowCount!==1)throw new Error('Site must match exactly once');
 const site=sites.rows[0];
 const admins=await db.query("SELECT subject FROM organisation_memberships WHERE organisation_id=$1 AND role='administrator' AND all_sites=true",[site.organisation_id]);
 if(admins.rowCount!==1)throw new Error('Owner scope ambiguous');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[site.id+':device-import']);
 const gateways=await db.query('SELECT id,role,hardware_model FROM gateways WHERE hardware_configuration_id=(SELECT id FROM hardware_configurations WHERE site_id=$1 ORDER BY revision DESC LIMIT 1)',[site.id]);
 if(gateways.rowCount!==2||gateways.rows.filter(g=>g.role==='controller').length!==1||gateways.rows.filter(g=>g.role==='device-node').length!==1)throw new Error('Expected registered pair');
 const old=await db.query("SELECT revision,configuration FROM site_configurations WHERE site_id=$1 AND section='device-import' ORDER BY revision DESC LIMIT 1",[site.id]);
 if(old.rows[0]?.configuration.sourceHash===hash){await db.query('COMMIT');console.log('Already imported; no duplicate revision.');}
 else {
 const revision=(old.rows[0]?.revision||0)+1;
 const directory=process.env.GRIDEX_DEVICE_VAULT_DIRECTORY+'/imports';
 const key=await fs.readFile(process.env.GRIDEX_DEVICE_VAULT_KEY_FILE);
 const iv=randomBytes(12),aad=site.id+':'+hash,cipher=createCipheriv('aes-256-gcm',key,iv);cipher.setAAD(Buffer.from(aad));
 const ciphertext=Buffer.concat([cipher.update(input.content,'utf8'),cipher.final()]);
 await fs.mkdir(directory,{recursive:true,mode:0o700});
 await fs.writeFile(directory+'/'+site.id+'-'+hash+'.json',JSON.stringify({version:1,aad,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),ciphertext:ciphertext.toString('base64')}),{mode:0o600});
 const configuration={schemaVersion:1,sourceHash:hash,importedAt:new Date().toISOString(),mode:'existing-local-test',physicalChangesApplied:false,telemetryVerified:false,pollMs,timeoutMs,dhcpReservation:true,commissioningApproved:false,devices:gateways.rows.map(g=>({gatewayId:g.id,kind:g.role,configurationSource:'rockpi-env',provisioning:'existing-test-configuration',communication:g.role==='controller'?'node-polling-and-local-modbus-listener':'modbus-tcp-via-rockpi',driverVerified:false}))};
 await db.query("UPDATE site_configurations SET status='superseded' WHERE site_id=$1 AND section='device-import' AND status='active'",[site.id]);
 await db.query("INSERT INTO site_configurations(id,site_id,section,revision,configuration,status,created_by) VALUES($1,$2,'device-import',$3,$4,'active',$5)",[randomUUID(),site.id,revision,configuration,admins.rows[0].subject]);
 await db.query("INSERT INTO audit_events(subject,site_id,action,resource_type,resource_id,result,request_id,details) VALUES($1,$2::uuid,'device.test_configuration.imported','site',$2::text,'success',$3,$4)",[admins.rows[0].subject,site.id,randomUUID(),{revision,physicalChangesApplied:false}]);
 await db.query('COMMIT');console.log(JSON.stringify({imported:true,devices:2,revision,pollMs,encryptedSource:true,physicalChangesApplied:false,telemetryVerified:false}));
 }
}catch(error){await db.query('ROLLBACK');console.log(JSON.stringify({failed:true,code:error.code||'validation',reason:error.message}));process.exitCode=1;}finally{await db.end();}
`;
const result = spawnSync('docker', ['--context','colima-gridex','exec','-i','gridex-mac-gridex-api-1','node','--input-type=module','-e',source], { input:JSON.stringify({content:fs.readFileSync(file,'utf8'),organizationName,siteName}), encoding:'utf8' });
if(result.status!==0){console.error('Import failed; no source configuration printed.');process.stdout.write(result.stdout);process.exitCode=1;}
else process.stdout.write(result.stdout);
