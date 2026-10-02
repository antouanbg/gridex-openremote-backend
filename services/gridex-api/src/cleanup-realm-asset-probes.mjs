// Recovery for temporary Assets created by check-realm-asset-service.mjs.
// Refuses to touch anything linked, parented or outside the exact probe shape.
import { loadConfig } from './config.mjs';
import { PostgresRepository } from './repository.mjs';
import { OpenRemoteRealmSetup } from './organisation-onboarding.mjs';
import { OpenRemoteClient } from './openremote-client.mjs';

if (!process.argv.includes('--apply')) throw new Error('Explicit --apply required.');
const config = loadConfig();
const repository = new PostgresRepository(config.database);
try {
  const { rows } = await repository.pool.query(`SELECT openremote_realm AS realm
    FROM organisations WHERE status='active' ORDER BY openremote_realm`);
  const setup = new OpenRemoteRealmSetup(config);
  const remote = new OpenRemoteClient(config);
  for (const { realm } of rows) {
    const credentials = await setup.assetServiceCredentials(realm);
    const assets = await remote.queryAssets({}, credentials.token, realm);
    const candidates = assets.filter(asset => asset.realm === realm && asset.parentId == null
      && /^GrideX access probe [0-9a-f-]{36}$/.test(asset.name || ''));
    if (candidates.length > 2) throw new Error('Unexpected probe count; manual review required.');
    const probes = [];
    for (const candidate of candidates) {
      const asset = await remote.getAsset(candidate.id, credentials.token, realm);
      if (asset.attributes?.gridexProbe?.value !== true
          || asset.attributes?.notes?.value !== 'Temporary GrideX permission probe')
        throw new Error('Probe candidate does not match the exact test shape.');
      probes.push(asset);
    }
    const links = await remote.realmUserAssetLinks(credentials.token, realm, credentials.apiRealm);
    for (const asset of probes) {
      if (links.some(link => link?.id?.assetId === asset.id))
        throw new Error('Linked probe requires manual review.');
      await remote.request(`/asset?assetId=${encodeURIComponent(asset.id)}`,
        { token:credentials.token, method:'DELETE', realm });
      let removed = false;
      try { await remote.getAsset(asset.id, credentials.token, realm); }
      catch (error) { removed = error.status === 404; }
      if (!removed) throw new Error('Probe deletion was not verified.');
    }
    console.log(JSON.stringify({ realm, unlinkedProbeAssetsRemoved:probes.length }));
  }
} finally { await repository.close(); }
