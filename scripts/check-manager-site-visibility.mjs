// Read-only: report metadata flags, never attribute values, IDs or credentials.
import {loadConfig} from '/app/src/config.mjs';
import {createRepository} from '/app/src/repository.mjs';
import {OpenRemoteRealmSetup} from '/app/src/organisation-onboarding.mjs';
import {OpenRemoteClient} from '/app/src/openremote-client.mjs';
const config=loadConfig(),repo=createRepository(config),setup=new OpenRemoteRealmSetup(config);
const remote=new OpenRemoteClient(config,fetch,realm=>setup.assetServiceCredentials(realm));
try {
  const orgs=(await repo.pool.query(`SELECT o.openremote_realm realm,m.subject
    FROM organisations o JOIN organisation_memberships m ON m.organisation_id=o.id
    WHERE o.status='active' AND o.openremote_realm='novacom' AND m.role='administrator'`)).rows;
  for(const org of orgs){
    const sites=await repo.listAccessibleSites(org.subject,org.realm);
    const credentials=await setup.assetServiceCredentials(org.realm);
    for(const site of sites){
      if(!site.openremoteSiteAssetId)throw new Error('Site binding is missing');
      const asset=await remote.getAsset(site.openremoteSiteAssetId,credentials.token,org.realm);
      console.log(JSON.stringify({readOnly:true,realm:org.realm,attributeMetadata:
        Object.entries(asset.attributes||{}).map(([name,a])=>({name,readRestricted:a.meta?.readRestricted===true,
          writeRestricted:a.meta?.writeRestricted===true,hasValue:a.value!=null}))}));
    }
  }
} finally {await repo.close();}
