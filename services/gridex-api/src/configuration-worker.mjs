import { setTimeout as delay } from "node:timers/promises";
import { loadConfig, validateProductionConfig } from "./config.mjs";
import { OpenRemoteClient } from "./openremote-client.mjs";
import { createRepository } from "./repository.mjs";
import { ConfigurationOutboxWorker } from "./configuration-worker-service.mjs";

const config=loadConfig();
validateProductionConfig(config);
const repository=createRepository(config);
if(config.autoMigrate) await repository.migrate();
const worker=new ConfigurationOutboxWorker({repository,openRemote:new OpenRemoteClient(config),maximumAttempts:config.configurationWorkerMaximumAttempts,leaseSeconds:config.configurationWorkerLeaseSeconds});
const controller=new AbortController();
process.on("SIGTERM",()=>controller.abort()); process.on("SIGINT",()=>controller.abort());
console.log("GrideX configuration outbox worker started");
while(!controller.signal.aborted){
  const processed=await worker.processOnce();
  if(!processed) await delay(config.configurationWorkerPollMs,undefined,{signal:controller.signal}).catch(()=>{});
}
await repository.close();
