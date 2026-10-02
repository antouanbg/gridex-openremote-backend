// Operator-only migration for already active realms. New realms are provisioned
// by OrganisationOnboarding after the member-access gate is enabled.
import { loadConfig } from './config.mjs';
import { PostgresRepository } from './repository.mjs';
import { OpenRemoteRealmSetup } from './organisation-onboarding.mjs';
import { OpenRemoteClient } from './openremote-client.mjs';

const config = loadConfig();
const repository = new PostgresRepository(config.database);
try {
  const { rows } = await repository.pool.query(`SELECT openremote_realm AS realm
    FROM organisations WHERE status='active' ORDER BY openremote_realm`);
  if (!config.realmSetupEnabled || !config.realmSetupClientSecret || !rows.length)
    throw new Error('Realm setup or active organisation inventory is unavailable.');
  const setup = new OpenRemoteRealmSetup(config);
  const remote = new OpenRemoteClient(config);
  const apply = process.argv.includes('--apply');
  for (const { realm } of rows) {
    if (!/^[a-z][a-z0-9-]{2,30}$/.test(realm) || realm === 'master')
      throw new Error('Invalid active organisation realm.');
    if (apply) await setup.provisionAssetServiceClient(realm);
    else await setup.verifyRealm(realm);
    if (apply) {
      const credentials = await setup.assetServiceCredentials(realm);
      await remote.realmUserAssetLinks(credentials.token, realm, credentials.apiRealm);
    }
    console.log(JSON.stringify({ realm, assetService: apply ? 'provisioned_and_link_read_verified' : 'planned' }));
  }
} finally { await repository.close(); }
