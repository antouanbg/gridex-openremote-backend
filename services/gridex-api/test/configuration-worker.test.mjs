import test from "node:test";
import assert from "node:assert/strict";
import { buildConfigurationProjection } from "../src/configuration-projection.mjs";
import { ConfigurationOutboxWorker } from "../src/configuration-worker-service.mjs";
import { MemoryRepository } from "../src/repository.mjs";

const site={id:"site-1",openremoteSiteAssetId:"or-site",openremoteStrategyAssetId:"or-strategy"};

test("projects only allow-listed strategy configuration attributes",()=>{
  const operations=buildConfigurationProjection({section:"strategy",revision:7,configuration:{code:"intelligent_hybrid",fallbackMode:"safe_idle",controlIntervalSeconds:60,reoptimiseMinutes:15,lossProtection:{mode:"full_cost"},requestedPowerKw:125}}, {site,bindings:[]});
  assert.equal(operations[0].assetId,"or-strategy");
  assert.equal(operations[0].attributes.configurationStrategyCode,"intelligent_hybrid");
  assert.equal(operations[0].attributes.gridexConfigurationRevision,7);
  assert.equal("requestedPowerKw" in operations[0].attributes,false);
});

test("uses trusted bindings instead of payload Asset IDs for PV arrays",()=>{
  const operations=buildConfigurationProjection({section:"pv",revision:3,configuration:{arrays:[{id:"array-1",openRemoteAssetId:"untrusted",enabled:true,orientationProfile:"south",mountingType:"rooftop",trackingType:"fixed",dcKwp:100,tiltDeg:25,azimuthDeg:180,performanceRatio:.82}]}},{site,bindings:[{section:"pv",localResourceType:"pv_array",localResourceId:"array-1",openremoteAssetId:"trusted-pv"}]});
  assert.equal(operations[0].assetId,"trusted-pv");
});

test("worker applies and verifies a configuration revision",async()=>{
  const repository=new MemoryRepository({sites:[site]});
  repository.configurations.set("site-1:site",{id:"configuration-1",revision:1,status:"activating",configuration:{siteCode:"SITE-001",countryCode:"BG",timezone:"Europe/Sofia",marketCode:"IBEX",latitude:42.7,longitude:23.3},openRemoteSync:{state:"pending"}});
  repository.configurationOutbox.push({id:"event-1",siteId:"site-1",configurationId:"configuration-1",section:"site",revision:1,configuration:(await repository.getSiteConfiguration("site-1","site")).configuration,attempts:0,status:"pending"});
  const attributes={};
  const openRemote={
    writeManagedAttribute:async(_assetId,name,value)=>{attributes[name]={value};},
    getManagedAsset:async()=>({attributes}),
  };
  const worker=new ConfigurationOutboxWorker({repository,openRemote,logger:{info(){},error(){}}});
  assert.equal(await worker.processOnce(),true);
  assert.equal(repository.configurationOutbox[0].status,"applied");
  assert.equal((await repository.getSiteConfiguration("site-1","site")).openRemoteSync.state,"applied");
});

test("worker retries without marking a revision applied",async()=>{
  const repository=new MemoryRepository({sites:[site]});
  repository.configurations.set("site-1:site",{id:"configuration-1",revision:1,status:"activating",configuration:{siteCode:"SITE-001"},openRemoteSync:{state:"pending"}});
  repository.configurationOutbox.push({id:"event-1",siteId:"site-1",configurationId:"configuration-1",section:"site",revision:1,configuration:{siteCode:"SITE-001"},attempts:0,status:"pending"});
  const worker=new ConfigurationOutboxWorker({repository,openRemote:{writeManagedAttribute:async()=>{throw new Error("temporary failure");}},logger:{info(){},error(){}}});
  await worker.processOnce();
  assert.equal(repository.configurationOutbox[0].status,"pending");
  assert.equal((await repository.getSiteConfiguration("site-1","site")).status,"activating");
});

test("worker dead-letters a permanent failure at the configured limit",async()=>{
  const repository=new MemoryRepository({sites:[site]});
  repository.configurations.set("site-1:site",{id:"configuration-1",revision:1,status:"activating",configuration:{siteCode:"SITE-001"},openRemoteSync:{state:"pending"}});
  repository.configurationOutbox.push({id:"event-1",siteId:"site-1",configurationId:"configuration-1",section:"site",revision:1,configuration:{siteCode:"SITE-001"},attempts:0,status:"pending"});
  const worker=new ConfigurationOutboxWorker({repository,maximumAttempts:1,openRemote:{writeManagedAttribute:async()=>{throw new Error("permanent failure");}},logger:{info(){},error(){}}});
  await worker.processOnce();
  assert.equal(repository.configurationOutbox[0].status,"dead_letter");
  assert.equal((await repository.getSiteConfiguration("site-1","site")).openRemoteSync.state,"failed");
});
