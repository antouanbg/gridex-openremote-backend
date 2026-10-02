// Operator-only, fail-closed migration of existing human Manager accounts.
// Dry-run by default. Back up Keycloak/DB before --apply; do not run at startup.
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.mjs';
import { PostgresRepository } from './repository.mjs';
import { OpenRemoteRealmSetup } from './organisation-onboarding.mjs';
import { OpenRemoteClient } from './openremote-client.mjs';
import { InvitationService } from './invitations.mjs';

const config = loadConfig();
const repository = new PostgresRepository(config.database);
const setup = new OpenRemoteRealmSetup(config);
const remote = new OpenRemoteClient(config);
const invitations = new InvitationService(repository.pool, null, remote, true);
const apply = process.argv.includes('--apply');
const realmArg = process.argv.find(value => value.startsWith('--realm='));
const onlyRealm = realmArg?.slice('--realm='.length);
if (apply && (!onlyRealm || !process.argv.includes('--backup-confirmed')))
  throw new Error('--apply requires one exact --realm and --backup-confirmed.');

try {
  const { rows: organisations } = await repository.pool.query(`SELECT id,openremote_realm AS realm
    FROM organisations WHERE status='active' ORDER BY openremote_realm`);
  const selected = organisations.filter(org => !onlyRealm || org.realm === onlyRealm);
  if (!selected.length || (onlyRealm && selected.length !== 1)) throw new Error('Active realm not found.');
  const plans = [];
  for (const org of selected) {
    const credentials = await setup.assetServiceCredentials(org.realm);
    const { rows: members } = await repository.pool.query(`SELECT m.subject,m.role,m.all_sites
      FROM organisation_memberships m WHERE m.organisation_id=$1 ORDER BY m.subject`, [org.id]);
    const { rows: sites } = await repository.pool.query(`SELECT id FROM sites
      WHERE organisation_id=$1 AND deleted_at IS NULL`, [org.id]);
    const scoped = await invitations.scopedAssets({ query: (...args) => repository.pool.query(...args) }, org.id, org.realm);
    const allLinks = await remote.realmUserAssetLinks(credentials.token, org.realm, credentials.apiRealm);
    for (const member of members) {
      const { rows: grants } = await repository.pool.query(`SELECT site_id FROM membership_site_grants
        WHERE organisation_id=$1 AND subject=$2`, [org.id, member.subject]);
      const siteIds = new Set(member.all_sites ? sites.map(site => site.id) : grants.map(grant => grant.site_id));
      const desired = new Set(scoped.filter(asset => siteIds.has(asset.siteId)).map(asset => asset.assetId));
      const actual = new Set(allLinks.filter(link => link?.id?.userId === member.subject)
        .map(link => link.id.assetId));
      const unexpected = [...actual].filter(id => !desired.has(id));
      if (unexpected.length) {
        const assets = await Promise.all(unexpected.map(async id => {
          const asset = await remote.getAsset(id, credentials.token, org.realm);
          return { id, type: asset?.type, name: asset?.name, parentId: asset?.parentId };
        }));
        console.log(JSON.stringify({ realm: org.realm, memberRole: member.role,
          preExistingAssetsOutsideSiteProjection: assets,
          action: member.role === 'administrator' ? 'preserve_and_reconcile_separately' : 'manual_reconciliation_required' }));
        // Historical, already-linked Assets can be personal Manager consoles or
        // telemetry children absent from the Site projection. Never delete them
        // as a side effect of changing roles. Non-admin exceptions fail closed.
        if (member.role !== 'administrator')
          throw new Error(`Unexpected Asset links in ${org.realm}; manual reconciliation required.`);
      }
      const missing = [...desired].filter(id => !actual.has(id));
      const roles = await setup.migrateHumanReader(org.realm, member.subject);
      plans.push({ realm: org.realm, organisationId: org.id, subject: member.subject,
        credentials, missing, desired, roles });
      console.log(JSON.stringify({ realm: org.realm, role: member.role,
        sites: siteIds.size, linksToAdd: missing.length, rolesToRemove: roles.remove,
        addRead: roles.addRead, addRestricted: roles.addRestricted, mode: apply ? 'preflight' : 'dry_run' }));
    }
  }
  if (apply) for (const plan of plans) {
    for (const assetId of plan.missing) await remote.linkUserAsset(assetId, plan.subject,
      plan.credentials.token, plan.realm, plan.credentials.apiRealm);
    const links = await remote.userAssetLinks(plan.subject, plan.credentials.token,
      plan.realm, plan.credentials.apiRealm);
    const linked = new Set(links.map(link => link?.id?.assetId));
    if ([...plan.desired].some(id => !linked.has(id)))
      throw new Error(`Asset links not verified in ${plan.realm}; roles unchanged for this member.`);
    await setup.migrateHumanReader(plan.realm, plan.subject, true);
    await repository.pool.query(`INSERT INTO audit_events(subject,action,resource_type,resource_id,result,request_id)
      VALUES($1,'member.openremote_read_only_migrated','organisation',$2,'success',$3)`,
      [plan.subject, plan.organisationId, randomUUID()]);
    console.log(JSON.stringify({ realm: plan.realm, roleMigration: 'verified', linkedAssets: linked.size }));
  }
} finally { await repository.close(); }
