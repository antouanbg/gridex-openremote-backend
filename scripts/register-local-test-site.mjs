// Run inside API container with {organizationName,siteName} on stdin.
// Inventory only: no device commands, OpenRemote activation or network changes.
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {validateHardwareConfiguration} from './src/hardware-config.mjs';
const input=JSON.parse(fs.readFileSync(0,'utf8'));
if(!input.organizationName || !input.siteName) throw new Error('Organization and site name required');
const hardware=validateHardwareConfiguration({gateways:[
 {name:'ROCK Pi E',hardwareModel:'rock-pi-e',role:'controller',managementNetwork:{mode:'local-test',wireguard:false},ports:[
  {name:'Management LAN',transport:'ethernet',channel:'management',settings:{}},
  {name:'OT LAN',transport:'ethernet',channel:'end1',settings:{addressing:'dhcp-server'}}]},
 {name:'ESP32 test node',hardwareModel:'olimex-esp32-evb-lab',role:'device-node',managementNetwork:{addressing:'dhcp',mode:'local-test'},ports:[
  {name:'OT Ethernet',transport:'ethernet',channel:'ethernet',settings:{addressing:'dhcp'}},
  {name:'RS485 (disabled)',transport:'rs485',channel:'rs485',settings:{enabled:false,batteryModbusEnabled:false}}]}
]});
const db=new pg.Client(); await db.connect();
try {
 await db.query('BEGIN');
 await db.query("SELECT pg_advisory_xact_lock(hashtext('register-local-test-site'))");
 const org=await db.query("SELECT id FROM organisations WHERE name=$1 AND status='active'",[input.organizationName]);
 if(org.rowCount!==1) throw new Error('Organization must match exactly once');
 const orgId=org.rows[0].id;
 const admins=await db.query("SELECT subject FROM organisation_memberships WHERE organisation_id=$1 AND role='administrator' AND all_sites=true",[orgId]);
 if(admins.rowCount!==1) throw new Error('Expected exactly one owning administrator');
 const subject=admins.rows[0].subject;
 const prior=await db.query("SELECT resource_id FROM audit_events WHERE action='site.local_test.registered' AND details->>'organisationId'=$1",[orgId]);
 if(prior.rowCount) {await db.query('COMMIT'); console.log(JSON.stringify({status:'already_registered',siteId:prior.rows[0].resource_id}));}
 else {
 const site=randomUUID(), configuration=randomUUID();
 await db.query("INSERT INTO sites(id,organisation_id,name,timezone,status,openremote_realm) VALUES($1,$2,$3,'Europe/Sofia','commissioning','gridex')",[site,orgId,input.siteName]);
 await db.query("INSERT INTO hardware_configurations(id,site_id,revision,status,created_by) VALUES($1,$2,1,'draft',$3)",[configuration,site,subject]);
 for(const gateway of hardware.gateways) {
  const id=randomUUID();
  await db.query('INSERT INTO gateways(id,hardware_configuration_id,site_id,name,hardware_model,role,management_network) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,configuration,site,gateway.name,gateway.hardwareModel,gateway.role,JSON.stringify(gateway.managementNetwork)]);
  for(const port of gateway.ports) await db.query('INSERT INTO gateway_ports(id,gateway_id,name,transport,channel,settings) VALUES($1,$2,$3,$4,$5,$6)',[randomUUID(),id,port.name,port.transport,port.channel,JSON.stringify(port.settings)]);
 }
 await db.query("INSERT INTO audit_events(subject,site_id,action,resource_type,resource_id,result,request_id,details) VALUES($1,$2::uuid,'site.local_test.registered','site',$2::text,'success',$3,$4)",[subject,site,randomUUID(),JSON.stringify({organisationId:orgId,demoIntent:'sanitized-read-only',wireguard:false,batteryModbus:false,physicalConfigurationApplied:false})]);
 await db.query('COMMIT');
 console.log(JSON.stringify({status:'registered',siteId:site,gateways:2,configuration:'draft',telemetry:'not_verified',physicalConfigurationApplied:false}));
 }
} catch(e) {await db.query('ROLLBACK'); throw e;} finally {await db.end();}
