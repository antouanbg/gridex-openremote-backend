// Runs inside API container; private credentials and approved owner arrive on stdin.
// Does not set passwords, verify identities or assign Keycloak administrative roles to owner.
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
const s = JSON.parse(fs.readFileSync(0,'utf8'));
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.ownerEmail) || !s.organizationName || !s.enrollmentSecret) throw new Error('Missing bootstrap settings');
const base = 'http://keycloak:8080/auth';
async function request(path, options={}) {
  const r=await fetch(base+path,{...options,signal:AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`Identity operation failed: ${r.status} ${path.split('?')[0]}`);
  const text=await r.text(); return text ? JSON.parse(text):null;
}
const token=await request('/realms/master/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',username:'admin',password:s.adminPassword})});
const headers={Authorization:`Bearer ${token.access_token}`,'Content-Type':'application/json'};
const admin='/admin/realms/gridex';
const call=(path,method='GET',body)=>request(admin+path,{headers,method,...(body===undefined?{}:{body:JSON.stringify(body)})});
let clients=await call('/clients?clientId=gridex-enrollment');
if (!clients.length) {
 await call('/clients','POST',{clientId:'gridex-enrollment',protocol:'openid-connect',secret:s.enrollmentSecret,publicClient:false,serviceAccountsEnabled:true,standardFlowEnabled:false,directAccessGrantsEnabled:false});
 clients=await call('/clients?clientId=gridex-enrollment');
}
if(clients.length!==1) throw new Error('Enrollment client conflict');
const client=clients[0];
const secret=await call(`/clients/${client.id}/client-secret`);
if(secret.value!==s.enrollmentSecret) throw new Error('Enrollment client secret differs; no rotation performed');
const service=await call(`/clients/${client.id}/service-account-user`);
const [management]=await call('/clients?clientId=realm-management');
const roles=await Promise.all(['manage-users','view-users','query-users'].map(r=>call(`/clients/${management.id}/roles/${r}`)));
await call(`/users/${service.id}/role-mappings/clients/${management.id}`,'POST',roles);
const enrollmentToken=await request('/realms/gridex/protocol/openid-connect/token',{method:'POST',body:new URLSearchParams({client_id:'gridex-enrollment',grant_type:'client_credentials',client_secret:s.enrollmentSecret})});
await request(admin+'/users?email='+encodeURIComponent(s.ownerEmail)+'&exact=true',{headers:{Authorization:`Bearer ${enrollmentToken.access_token}`}});
console.log('Dedicated enrollment authentication and user lookup verified.');
// No public signup: invitations and a private initial-owner bootstrap only.
await call('','PUT',{registrationAllowed:false,resetPasswordAllowed:true,verifyEmail:true,loginWithEmailAllowed:true});
let users=await call('/users?email='+encodeURIComponent(s.ownerEmail)+'&exact=true');
if(!users.length) {
 await call('/users','POST',{username:s.ownerEmail,email:s.ownerEmail,enabled:true,emailVerified:false,requiredActions:['VERIFY_EMAIL','UPDATE_PASSWORD']});
 users=await call('/users?email='+encodeURIComponent(s.ownerEmail)+'&exact=true');
}
if(users.length!==1 || !users[0].enabled || users[0].email!==s.ownerEmail) throw new Error('Owner identity conflict');
const user=users[0];
const db=new pg.Client(); await db.connect();
let organization;
try {
 await db.query('BEGIN');
 await db.query("SELECT pg_advisory_xact_lock(hashtext('gridex-initial-owner'))");
 let {rows}=await db.query('SELECT id,name FROM organisations WHERE openremote_realm=$1',['gridex']);
 if(!rows.length) { const id=randomUUID(); await db.query('INSERT INTO organisations(id,name,openremote_realm) VALUES($1,$2,$3)',[id,s.organizationName,'gridex']); rows=[{id,name:s.organizationName}]; }
 if(rows[0].name!==s.organizationName) throw new Error('Organization conflict');
 organization=rows[0].id;
 const existing=await db.query('SELECT subject,role FROM organisation_memberships WHERE organisation_id=$1',[organization]);
 if(existing.rows.some(r=>r.subject!==user.id)) throw new Error('Organization is not an initial-owner bootstrap target');
 if(existing.rows.some(r=>r.role!=='administrator')) throw new Error('Existing role differs; no silent privilege change');
 await db.query("INSERT INTO organisation_memberships(organisation_id,subject,role,all_sites) VALUES($1,$2,'administrator',true) ON CONFLICT(organisation_id,subject) DO NOTHING",[organization,user.id]);
 await db.query('COMMIT');
 // Idempotent delivery checkpoint. Do not automatically resend successful requests.
 const prior=await db.query("SELECT id FROM audit_events WHERE action='owner.registration.email_queued' AND resource_id=$1",[user.id]);
 if(prior.rowCount) { console.log('Owner already bootstrapped; previous email submission recorded; no resend.'); }
 else {
   const uncertain=await db.query("SELECT id FROM audit_events WHERE action='owner.registration.email_started' AND resource_id=$1",[user.id]);
   if(uncertain.rowCount) throw new Error('Prior delivery attempt has unknown outcome; inspect provider before an explicit resend');
   await db.query("INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id) VALUES($1,'owner.registration.email_started','user',$2,'pending',$3)",['operator-bootstrap',user.id,randomUUID()]);
   const query=new URLSearchParams({client_id:'gridex-portal',redirect_uri:s.portalOrigin+'/',lifespan:'86400'});
   await call(`/users/${user.id}/execute-actions-email?${query}`,'PUT',['VERIFY_EMAIL','UPDATE_PASSWORD']);
   await db.query("INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id) VALUES($1,'owner.registration.email_queued','user',$2,'queued',$3)",['operator-bootstrap',user.id,randomUUID()]);
   console.log('Organization administrator provisioned; Keycloak registration email accepted. Inbox and completion not verified.');
 }
} catch(e) { await db.query('ROLLBACK'); throw e; } finally { await db.end(); }
