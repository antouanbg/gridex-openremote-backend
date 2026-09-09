import { createServer } from "node:http";
import { createAuthenticator } from "./auth.mjs";
import { createApp } from "./app.mjs";
import { loadConfig, validateProductionConfig } from "./config.mjs";
import { OpenRemoteClient } from "./openremote-client.mjs";
import { createRepository } from "./repository.mjs";

const config = loadConfig();
validateProductionConfig(config);
const repository = createRepository(config);
if (config.autoMigrate) await repository.migrate();
const openRemote = new OpenRemoteClient(config);
const authenticate = createAuthenticator(config);
const server = createServer(createApp({ config, authenticate, repository, openRemote }));

server.listen(config.port, "0.0.0.0", () => console.log(`GrideX API listening on ${config.port}`));

async function shutdown() {
  server.close();
  await repository.close();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
