// Live, reversible acceptance probe. Creates one unlinked temporary Asset per
// active realm and deletes it in finally. Never runs on API startup.
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { PostgresRepository } from './repository.mjs';
import { OpenRemoteRealmSetup } from './organisation-onboarding.mjs';
import { OpenRemoteClient } from './openremote-client.mjs';

if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required for the live probe.');
const config = loadConfig();
const repository = new PostgresRepository(config.database);
const setup = new OpenRemoteRealmSetup(config);
const remote = new OpenRemoteClient(config);
try {
  const { rows } = await repository.pool.query(`SELECT openremote_realm AS realm
    FROM organisations WHERE status='active' ORDER BY openremote_realm`);
  if (!rows.length) throw new Error('No active organisation realms to verify.');
  for (const { realm } of rows) {
    const credentials = await setup.assetServiceCredentials(realm);
    let assetId = null;
    try {
      const probe = await remote.createUserAsset({ name:`GrideX access probe ${randomUUID()}`,
        type:'ThingAsset', realm, attributes:{
          location:{ type:'GEO_JSONPoint', value:null, meta:{} },
          notes:{ type:'text', value:'Temporary GrideX permission probe', meta:{} },
          gridexProbe:{ type:'boolean', value:true, meta:{} },
        } },
      credentials.token, realm);
      assetId = probe?.id;
      if (!assetId || probe.realm !== realm) throw new Error('Asset create was not verified.');
      const fetched = await remote.getAsset(assetId, credentials.token, realm);
      if (fetched?.id !== assetId || fetched.realm !== realm) throw new Error('Asset read was not verified.');
      const foreign = rows.find(item => item.realm !== realm)?.realm;
      if (foreign) {
        let denied = false;
        try { await remote.getAsset(assetId, credentials.token, foreign); }
        catch (error) { denied = [401,403,404].includes(error.status); }
        if (!denied) throw new Error('Cross-realm Asset read was not denied.');
      }
      const identity = await setup.assetServiceIdentity(realm, await setup.token());
      await remote.linkUserAsset(assetId, identity.serviceUser.id, credentials.token, realm, credentials.apiRealm);
      const links = await remote.userAssetLinks(identity.serviceUser.id, credentials.token, realm, credentials.apiRealm);
      if (!links.some(link => link?.id?.assetId === assetId)) throw new Error('Asset link write was not verified.');
      await remote.deleteUserAssetLink(assetId, identity.serviceUser.id, credentials.token, realm, credentials.apiRealm);
      const after = await remote.userAssetLinks(identity.serviceUser.id, credentials.token, realm, credentials.apiRealm);
      if (after.some(link => link?.id?.assetId === assetId)) throw new Error('Asset link delete was not verified.');
      console.log(JSON.stringify({ realm, assetCreateRead:true, linkWriteDelete:true, crossRealmDenied:!!foreign }));
    } finally {
      if (assetId) {
        await remote.request(`/asset?assetId=${encodeURIComponent(assetId)}`,
          { token:credentials.token, method:'DELETE', realm });
        try { await remote.getAsset(assetId, credentials.token, realm); }
        catch (error) { if (error.status !== 404) throw error; }
      }
    }
  }
} finally { await repository.close(); }
