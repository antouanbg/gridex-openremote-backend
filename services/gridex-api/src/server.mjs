import { createServer } from "node:http";
import { createAuthenticator } from "./auth.mjs";
import { createApp } from "./app.mjs";
import { loadConfig, validateProductionConfig } from "./config.mjs";
import { OpenRemoteClient } from "./openremote-client.mjs";
import { createRepository } from "./repository.mjs";
import { EnrollmentIdentity, InvitationService } from './invitations.mjs';
import { OpenRemoteRealmSetup, OrganisationOnboarding } from './organisation-onboarding.mjs';
import { OrganisationAccess } from './organisation-access.mjs';
import { mailgunConfig } from './mailgun.mjs';
import {DeviceVault} from './device-vault.mjs';
import {DeviceHeartbeats} from './device-heartbeats.mjs';
import {HeartbeatEmailSubscriptions} from './heartbeat-subscriptions.mjs';
import {ManagerLaunch} from './manager-launch.mjs';
import {GrafanaLaunch} from './grafana-launch.mjs';
import { MarketStorage } from './market-storage.mjs';
import { ServiceEntitlements } from './service-entitlements.mjs';
import { ServiceRequests } from './service-requests.mjs';
import { ContactInquiries } from './contact-inquiries.mjs';

const config = loadConfig();
validateProductionConfig(config);
const repository = createRepository(config);
if (config.autoMigrate) await repository.migrate();
const realmSetup = config.realmSetupEnabled ? new OpenRemoteRealmSetup(config) : null;
const openRemote = new OpenRemoteClient(config, fetch, config.memberAccessEnabled
  ? realm => realmSetup?.assetServiceCredentials(realm)
    ?? Promise.reject(new Error('Realm Asset service is unavailable'))
  : null);
const authenticate = createAuthenticator(config, {
  isAllowedRealm: realm => repository.isAllowedRealm(realm),
});
const pilotEnrollment = new EnrollmentIdentity(config);
const enrollment = {
  assetLinkCredentials: async realm => config.memberAccessEnabled
    ? realmSetup?.assetServiceCredentials(realm)
      ?? Promise.reject(new Error('Realm Asset service is unavailable'))
    : realm && realm !== config.realm
    ? { token: await (realmSetup?.token() ?? Promise.reject(new Error('Realm setup is unavailable'))), apiRealm: 'master' }
    : { token: await openRemote.getServiceToken(), apiRealm: config.realm },
  prepareUser: (email, realm, names) => realm && realm !== config.realm
    ? realmSetup?.prepareMemberUser(realm, email, names)
      ?? Promise.reject(new Error('Realm setup is unavailable'))
    : pilotEnrollment.prepareUser(email, names),
  sendActions: (subject, created, realm) => realm && realm !== config.realm
    ? realmSetup?.sendMemberActions(realm, subject, created)
      ?? Promise.reject(new Error('Realm setup is unavailable'))
    : pilotEnrollment.sendActions(subject, created),
  inspectMemberUser: (subject, email, realm) => realm && realm !== config.realm
    ? realmSetup?.inspectMemberUser(realm, subject, email)
      ?? Promise.reject(new Error('Realm setup is unavailable'))
    : pilotEnrollment.inspectMemberUser(subject, email),
  ensureRestrictedReader: (realm, subject) => realmSetup?.ensureRestrictedReader(realm, subject)
    ?? Promise.reject(new Error('Realm role provisioning is unavailable')),
};
const invitations = config.enrollmentEnabled && repository.pool
  ? new InvitationService(repository.pool, enrollment, openRemote, config.memberAccessEnabled) : null;
const onboarding = repository.pool && config.realmSetupEnabled
  ? new OrganisationOnboarding(repository.pool, realmSetup, config.realm, config.memberAccessEnabled) : null;
const organisationAccess = onboarding && config.organisationAccessEnabled ? new OrganisationAccess(repository.pool, realmSetup, config,
  () => mailgunConfig()) : null;
const deviceVault=config.deviceVaultDirectory && config.deviceVaultKeyFile ? new DeviceVault(config.deviceVaultDirectory,config.deviceVaultKeyFile):null;
const deviceHeartbeats = repository.pool ? new DeviceHeartbeats(repository.pool) : null;
const heartbeatSubscriptions = repository.pool ? new HeartbeatEmailSubscriptions(repository.pool) : null;
const managerLaunch = repository.pool && config.managerPublicOrigin
  ? new ManagerLaunch(repository.pool, config.managerPublicOrigin, config.realm, config.platformAdminSubjects) : null;
const market = config.marketDatabase ? new MarketStorage(config.marketDatabase) : null;
const serviceEntitlements = repository.pool ? new ServiceEntitlements(repository.pool, config) : null;
const serviceRequests = repository.pool && serviceEntitlements
  ? new ServiceRequests(repository.pool, serviceEntitlements, market) : null;
const contactInquiries = new ContactInquiries({ recipient: process.env.GRIDEX_SUPPORT_INBOX, cc: process.env.GRIDEX_SUPPORT_CC });
const grafanaLaunch = repository.pool && market && config.grafanaPublicOrigin
  ? new GrafanaLaunch(repository.pool, config.grafanaPublicOrigin, config, market) : null;
if (managerLaunch) await managerLaunch.invalidateAll();
if (grafanaLaunch) await grafanaLaunch.invalidateAll();
const server = createServer(createApp({ config, authenticate, repository, openRemote, invitations, onboarding, organisationAccess, deviceVault, deviceHeartbeats, heartbeatSubscriptions, managerLaunch, grafanaLaunch, market, serviceEntitlements, serviceRequests, contactInquiries }));

server.listen(config.port, "0.0.0.0", () => console.log(`GrideX API listening on ${config.port}`));

async function shutdown() {
  server.close();
  await repository.close();
  await market?.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
