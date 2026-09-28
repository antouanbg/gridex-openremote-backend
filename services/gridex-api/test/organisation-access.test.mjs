import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import pg from 'pg';
import { ApiError } from '../src/errors.mjs';
import { OrganisationAccess } from '../src/organisation-access.mjs';
import { OpenRemoteRealmSetup } from '../src/organisation-onboarding.mjs';
import { PostgresRepository, MemoryRepository } from '../src/repository.mjs';
import { checkMailgunDelivery } from '../src/mailgun.mjs';
import { createApp } from '../src/app.mjs';
const owner = { subject: 'owner', realm: 'gridex', emailVerified: true, permissions: ['platform:manage'], authTime: Date.now()/1000 };
const config = { realm: 'gridex', platformAdminSubjects: new Set(['owner']) };

test('suspension requires verified allowlisted pilot identity and recent login', () => {
  const service = new OrganisationAccess(null, null, config, () => ({}));
  for (const change of [{ subject: 'impostor' },{ realm: 'customer' },{ emailVerified: false },{ permissions: [] }])
    assert.throws(() => service.authorize({ ...owner,...change },true), {status:403});
  assert.throws(() => service.authorize({...owner,authTime:0},true), {status:401});
});

test('mail verification matches customer recipient and message, not BCC or acceptance', async () => {
  const cfg={base:'https://mail.invalid',domain:'example.invalid',key:'fixture'};
  const event=(event,recipient='admin@example.invalid',id='message',severity)=>({event,recipient,severity,message:{headers:{'message-id':id}}});
  for (const [items,expected] of [
    [[event('accepted')],'queued'],[[event('delivered','bcc@example.invalid')],'queued'],
    [[event('delivered','admin@example.invalid','other')],'queued'],[[event('delivered')],'delivered'],
    [[event('failed',undefined,undefined,'temporary')],'queued'],[[event('failed',undefined,undefined,'permanent')],'failed'],
  ]) assert.equal(await checkMailgunDelivery(cfg,'<message>','admin@example.invalid',async()=>Response.json({items})),expected);
});

test('upstream suspension preserves realm and configures BG/EN, logs out without deleting identities', async () => {
  let enabled=true;const calls=[];
  const setup=new OpenRemoteRealmSetup({...config,openRemoteBaseUrl:'https://or.invalid',realmSetupAdminBaseUrl:'https://kc.invalid/admin/realms'},async(url,options)=>{
    calls.push({url,method:options.method,body:options.body});return new Response(null,{status:204});
  });
  setup.token=async()=> 'fixture';
  setup.or=async(path,token,method,body)=>{calls.push({path,method,body});if(method==='PUT'){assert.equal(body.displayName,'Keep');enabled=body.enabled;}return {name:'customer',enabled,displayName:'Keep'};};
  setup.kc=async(path,token,method)=>{calls.push({path,method});return {realm:'customer',enabled};};
  await setup.setOrganisationAccess('customer',false);
  assert.equal(enabled,false);
  assert.equal(calls.filter(c=>c.url?.includes('/localization/')).length,2);
  assert.ok(calls.some(c=>c.path==='/customer/logout-all'));
  assert.ok(calls.every(c=>c.method!=='DELETE'));
  await setup.setOrganisationAccess('customer',true);assert.equal(enabled,true);
  await assert.rejects(setup.setOrganisationAccess('gridex',false),{status:403});
});

test('API denies suspended sessions before all endpoints and checks delayed responses again', async () => {
  let blocked=false, checks=0;
  const repository = new MemoryRepository();
  repository.assertOrganisationAccess=async()=>{checks++;if(blocked){throw new ApiError(403,'organisation_suspended','Suspended');}};
  repository.getMemberships=async()=>{blocked=true;return [];};
  const app=createApp({config:{allowedOrigins:new Set(),maximumBodyBytes:2048},repository,authenticate:async()=>({...owner})});
  const server=createServer(app);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    const late=await fetch(`${base}/api/v1/me`);assert.equal(late.status,403);assert.ok(checks>=2);
    for(const route of ['/api/v1/me','/api/v1/sites','/api/v1/me/preferences','/api/v1/me/invitations','/api/v1/platform/organisations'])
      assert.equal((await fetch(`${base}${route}`)).status,403);
  } finally {await new Promise(r=>server.close(r));}
});

// An isolated PostgreSQL instance is required to prove transaction/locking/dedup,
// rather than teaching a SQL mock the implementation's own assumptions.
test('PostgreSQL: suspension, replay, failures, concurrent lock, restore and tenant sessions', {skip:!process.env.GRIDEX_ACCESS_TEST_DATABASE_URL}, async () => {
  const admin=new pg.Pool({connectionString:process.env.GRIDEX_ACCESS_TEST_DATABASE_URL});
  const schema='freeze_'+randomUUID().replaceAll('-','');
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool=new pg.Pool({connectionString:process.env.GRIDEX_ACCESS_TEST_DATABASE_URL,options:`-c search_path=${schema}`});
  try {
    for (const name of ['001_gridex_core.sql','003_membership_site_scope.sql','012_organisation_onboarding.sql','013_organisation_access.sql'])
      await pool.query(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
    const id=randomUUID(),other=randomUUID(),pilot=randomUUID();
    for (const [org,realm] of [[id,'customer'],[other,'other'],[pilot,'gridex']]) {
      await pool.query('INSERT INTO organisations(id,name,openremote_realm) VALUES($1,$2,$2)',[org,realm]);
      await pool.query(`INSERT INTO organisation_onboarding_invitations(id,organisation_id,realm,name,email,subject,created_by,state,expires_at)
        VALUES($1,$2,$3,$3,'admin@example.invalid','member','owner','accepted',now())`,[randomUUID(),org,realm]);
      await pool.query("INSERT INTO organisation_memberships(organisation_id,subject,role) VALUES($1,'member','administrator')",[org]);
    }
    let calls=0,sent=0,failUpstream=true,failMail=false;
    const setup={setOrganisationAccess:async()=>{calls++;if(failUpstream)throw Error('offline');},verifyUser:async()=>{}};
    const service=new OrganisationAccess(pool,setup,config,()=>({}),{send:async()=>{sent++;if(failMail)throw Error('timeout');return {id:'<message>'};},check:async()=> 'queued'});
    const repository=Object.create(PostgresRepository.prototype);repository.pool=pool;
    const input={operationId:randomUUID(),revision:0,status:'suspended'};
    await assert.rejects(service.change(owner,id,input),{status:503});
    assert.equal((await pool.query('SELECT status FROM organisations WHERE id=$1',[id])).rows[0].status,'suspended');
    await assert.rejects(repository.assertOrganisationAccess({realm:'customer',authTime:Date.now()/1000}),{status:403});
    await repository.assertOrganisationAccess({realm:'other',authTime:Date.now()/1000});
    assert.equal((await repository.getMemberships('member','customer')).length,0);
    assert.equal((await repository.getMemberships('member','other')).length,1);
    await assert.rejects(service.change(owner,id,{operationId:randomUUID(),revision:1,status:'active'}),{status:409});
    failUpstream=false;
    const result=await service.change(owner,id,input);assert.equal(result.mailState,'queued');assert.equal(sent,1);
    await service.change(owner,id,input);assert.equal(sent,1);assert.equal(calls,2);
    service.check=async()=> 'delivered';
    assert.equal((await service.checkDelivery(owner,id)).mailState,'delivered');
    await assert.rejects(service.change(owner,other,input),{status:409});
    await assert.rejects(service.change(owner,pilot,{...input,operationId:randomUUID()}),{status:403});
    const lock=await pool.connect();await lock.query('SELECT pg_advisory_lock(hashtextextended($1,13))',[id]);
    try {await assert.rejects(service.change(owner,id,input),{status:409});}finally{await lock.query('SELECT pg_advisory_unlock(hashtextextended($1,13))',[id]);lock.release();}
    const restore={operationId:randomUUID(),revision:1,status:'active'};
    failUpstream=true;await assert.rejects(service.change(owner,id,restore),{status:503});
    await assert.rejects(repository.assertOrganisationAccess({realm:'customer',authTime:Date.now()/1000}),{status:403});
    failUpstream=false;await service.change(owner,id,restore);
    await assert.rejects(repository.assertOrganisationAccess({realm:'customer',authTime:0}),{status:401});
    await repository.assertOrganisationAccess({realm:'customer',authTime:Date.now()/1000+5});
    await assert.rejects(service.change(owner,id,input),{status:409});assert.equal(sent,1);
    failMail=true;const again={operationId:randomUUID(),revision:2,status:'suspended'};
    assert.equal((await service.change(owner,id,again)).mailState,'unknown');
    await service.change(owner,id,again);assert.equal(sent,2);
    assert.equal((await pool.query('SELECT count(*) FROM organisation_memberships')).rows[0].count,'3');
  } finally {await pool.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});

test('SSE rechecks access and terminates an already open stream on suspension', async () => {
  let suspended=false;
  const repository={
    assertOrganisationAccess:async()=>{if(suspended)throw new ApiError(403,'organisation_suspended','Suspended');},
    getMemberships:async()=>[{role:'viewer'}],requireSite:async()=>({id:'fixture',membershipRole:'viewer'}),
    listDevices:async()=>[],getDailyBatteryEconomics:async()=>({available:false}),
  };
  const server=createServer(createApp({config:{allowedOrigins:new Set(),snapshotRefreshMs:10},authenticate:async()=>owner,repository,
    openRemote:{getManagedAssets:async()=>[]}}));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/v1/sites/fixture/events`);
    const reader=response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value),/event: snapshot/);
    suspended=true;
    let tail='';for(;;){const next=await reader.read();if(next.done)break;tail+=new TextDecoder().decode(next.value);}
    assert.match(tail,/event: access-denied/);assert.doesNotMatch(tail,/event: snapshot/);
  } finally {await new Promise(r=>server.close(r));}
});
