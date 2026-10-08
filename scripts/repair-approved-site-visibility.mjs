// Owner-approved Novacom Test Site only. Run inside API: prepare, back up, apply.
// No role, link, alarm, attribute value or internal-ID visibility changes.
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {loadConfig} from '/app/src/config.mjs';
import {createRepository} from '/app/src/repository.mjs';
import {OpenRemoteRealmSetup} from '/app/src/organisation-onboarding.mjs';
import {OpenRemoteClient} from '/app/src/openremote-client.mjs';
const config=loadConfig(),repo=createRepository(config),setup=new OpenRemoteRealmSetup(config);
const remote=new OpenRemoteClient(config,fetch,realm=>setup.assetServiceCredentials(realm));
const fingerprint=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
try {
  const rows=(await repo.pool.query(`SELECT s.id,s.openremote_site_asset_id asset_id
    FROM sites s JOIN organisations o ON o.id=s.organisation_id
    WHERE o.openremote_realm='novacom' AND o.status='active'
    AND s.name='Test' AND s.deleted_at IS NULL`)).rows;
  assert.equal(rows.length,1,'Expected exactly one approved test Site');
  const credentials=await setup.assetServiceCredentials('novacom');
  const asset=await remote.getAsset(rows[0].asset_id,credentials.token,'novacom');
  assert.equal(asset.realm,'novacom');assert.equal(asset.name,'Test');
  assert.equal(asset.attributes.gridexResourceKind.value,'site');
  assert.equal(asset.attributes.gridexSiteId.value,rows[0].id);
  assert.equal(asset.attributes.gridexResourceId.value,rows[0].id);
  assert.ok(asset.attributes.notes&&asset.attributes.location);
  if(!process.argv.includes('--apply')&&!process.argv.includes('--verify')) {
    const dir=await mkdtemp('/tmp/gridex-site-visibility-');
    await writeFile(`${dir}/before.json`,JSON.stringify(asset),{mode:0o600});
    console.log(JSON.stringify({prepared:true,backup:`${dir}/before.json`,changes:['notes.meta','location.meta']}));
  } else {
    const verifyOnly=process.argv.includes('--verify');
    const path=process.argv[process.argv.indexOf(verifyOnly?'--verify':'--apply')+1];
    assert.match(path||'',/^\/tmp\/gridex-site-visibility-[A-Za-z0-9]+\/before\.json$/);
    const before=JSON.parse(await readFile(path,'utf8'));
    if(!verifyOnly)assert.equal(fingerprint(asset),fingerprint(before),'Asset changed since backup; stop');
    const next=structuredClone(before);
    for(const name of ['notes','location'])next.attributes[name].meta={...next.attributes[name].meta,readRestricted:true,writeRestricted:false};
    if(!verifyOnly)await remote.request(`/asset/${encodeURIComponent(asset.id)}`,{realm:'novacom',token:credentials.token,method:'PUT',body:next});
    const actual=await remote.getAsset(asset.id,credentials.token,'novacom');
    for(const key of ['id','realm','name','type','parentId'])assert.equal(actual[key],before[key]);
    // OpenRemote refreshes server-owned attribute timestamps on metadata PUT.
    // Values, types and all metadata must still match the exact approved change.
    const semantic=attribute=>{const copy={...attribute};delete copy.timestamp;return copy;};
    for(const [name,attribute] of Object.entries(next.attributes))assert.deepEqual(semantic(actual.attributes[name]),semantic(attribute),`Unexpected change: ${name}`);
    assert.deepEqual(Object.keys(actual.attributes).sort(),Object.keys(before.attributes).sort());
    console.log(JSON.stringify({applied:true,verified:true,changedAttributes:['notes','location'],rolesChanged:false,linksChanged:false,backup:path}));
  }
} finally {await repo.close();}
