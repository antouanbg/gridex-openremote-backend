import { createServer } from "node:http";
import { createAuthenticator } from "./auth.mjs";
import { createApp } from "./app.mjs";
import { loadConfig, validateProductionConfig } from "./config.mjs";
import { OpenRemoteClient } from "./openremote-client.mjs";
import { createRepository } from "./repository.mjs";
import { EnrollmentIdentity, InvitationService } from './invitations.mjs';
import {DeviceVault} from './device-vault.mjs';
import {DeviceHeartbeats} from './device-heartbeats.mjs';
import {HeartbeatEmailSubscriptions} from './heartbeat-subscriptions.mjs';

const config = loadConfig();
validateProductionConfig(config);
const repository = createRepository(config);
if (config.autoMigrate) await repository.migrate();
const openRemote = new OpenRemoteClient(config);
const authenticate = createAuthenticator(config);
const invitations = config.enrollmentEnabled && repository.pool
  ? new InvitationService(repository.pool, new EnrollmentIdentity(config)) : null;
const deviceVault=config.deviceVaultDirectory && config.deviceVaultKeyFile ? new DeviceVault(config.deviceVaultDirectory,config.deviceVaultKeyFile):null;
const deviceHeartbeats = repository.pool ? new DeviceHeartbeats(repository.pool) : null;
const heartbeatSubscriptions = repository.pool ? new HeartbeatEmailSubscriptions(repository.pool) : null;
const server = createServer(createApp({ config, authenticate, repository, openRemote, invitations, deviceVault, deviceHeartbeats, heartbeatSubscriptions }));

server.listen(config.port, "0.0.0.0", () => console.log(`GrideX API listening on ${config.port}`));

async function shutdown() {
  server.close();
  await repository.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
