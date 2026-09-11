import test from "node:test";
import assert from "node:assert/strict";
import { validateConfiguration } from "../src/configuration-centre.mjs";
import { buildConfigurationProjection } from "../src/configuration-projection.mjs";

const valid = {
  site: { name:"Plant",siteCode:"SITE-001",countryCode:"BG",timezone:"Europe/Sofia",marketCode:"IBEX",latitude:42.7,longitude:23.3 },
  pv: { arrays:[{ id:"pv-1",name:"South roof",enabled:true,orientationProfile:"south",mountingType:"rooftop",trackingType:"fixed",dcKwp:250,tiltDeg:25,azimuthDeg:180,performanceRatio:.82,inverterDeviceId:"inv-1" }] },
  battery_pcs: { id:"bess-1",systemType:"all_in_one",coupling:"ac",manufacturer:"Suntech",model:"SunPro 261",pcsManufacturer:"Suntech",pcsModel:"125 kW PCS",usableCapacityKwh:261,ratedPcsPowerKw:125,minimumSocPct:10,maximumSocPct:95,reserveSocPct:20,chargeEfficiencyPct:96,dischargeEfficiencyPct:96,warrantedCycles:6000,assetValueEur:100000,residualValueEur:10000,usefulLifeMonths:120,gridChargePermitted:true,batteryExportPermitted:true },
  metering_grid: { pccMeterDeviceId:"meter-1",signConvention:"import_positive",ctRatio:1,vtRatio:1,phaseSequence:"L1_L2_L3",maximumImportKw:500,maximumExportKw:500,softwareFuseMarginKw:20,zeroExportToleranceKw:2,meterUnavailableMode:"safe_idle",submeters:[] },
  market_tariffs: { currency:"EUR",dayAheadSource:"IBEX",validFrom:"2026-01-01",components:[{type:"import_energy",priceEurPerMwh:5}] },
  forecast: { priceModels:[{modelKey:"gridex-research",weight:.5},{modelKey:"market-ensemble",weight:.5}],weatherProvider:"provider",pvModel:"physical",loadModel:"historical",horizonHours:72,resolutionMinutes:15,minimumConfidencePct:70,maximumAgeMinutes:60,fallbackModel:"persistence",trainingWindowDays:365 },
  strategy: { code:"intelligent_hybrid",fallbackMode:"safe_idle",controlIntervalSeconds:10,reoptimiseMinutes:15,lossProtection:{mode:"full_cost"},trackChargeOrigin:true,minimumNetProfitEurPerDay:0,minimumNetSpreadEurPerMwh:15,pvExportFloorEurPerMwh:0,batteryExportFloorEurPerMwh:40,includeBatteryDegradation:true,includeDepreciation:true,gridChargePermitted:true,batteryExportPermitted:true },
  loads_ev: { loads:[{id:"load-1",assetRelationId:"asset-load",priority:10,minimumPowerKw:0,maximumPowerKw:50,availability:{from:"08:00",to:"18:00"}}],evse:[{id:"evse-1",assetRelationId:"asset-evse",priority:20,minimumPowerKw:0,maximumPowerKw:22,availability:{from:"00:00",to:"23:59"}}] },
  edge_devices: { controller:{id:"controller-1",hardwareModel:"rock-pi-e",internalEthernetRole:"OT",uplinkEthernetRole:"CONTROL",wireguardEnabled:false},gateways:[{id:"gateway-1",hardwareModel:"olimex-esp32-evb",deviceType:"inverter",manufacturer:"Deye",driverKey:"deye-can",driverVersion:"1.0.0",ports:[{interfaceType:"CAN"}]}] },
  notifications_access: { recipients:[{userId:"user-1"}],minimumSeverity:"warning",channels:["email"],editRole:"engineer",activationRole:"administrator",dualApprovalRequired:true,retentionDays:365 },
};

test("accepts complete payloads for all ten configuration sections",()=>{
  for(const [section,payload] of Object.entries(valid)){
    const result=validateConfiguration(section,payload);
    assert.equal(result.valid,true,`${section}: ${JSON.stringify(result.errors)}`);
  }
});

const invalidCases = [
  ["site",{...valid.site,latitude:100},"/latitude"],
  ["pv",{arrays:[{...valid.pv.arrays[0],trackingType:"single_axis"}]},"/arrays/0/moduleLayout"],
  ["battery_pcs",{...valid.battery_pcs,maximumSocPct:5},"/maximumSocPct"],
  ["metering_grid",{...valid.metering_grid,meterUnavailableMode:"fixed_fallback"},"/fallbackImportLimitKw"],
  ["market_tariffs",{...valid.market_tariffs,currency:"BGN"},"/currency"],
  ["forecast",{...valid.forecast,priceModels:[{modelKey:"same"},{modelKey:"same"}]},"/priceModels"],
  ["strategy",{...valid.strategy,minimumNetSpreadEurPerMwh:undefined},"/minimumNetSpreadEurPerMwh"],
  ["loads_ev",{loads:[{...valid.loads_ev.loads[0],energyTargetKwh:10}],evse:[]},"/loads/0/deadline"],
  ["edge_devices",{...valid.edge_devices,controller:{...valid.edge_devices.controller,wireguardEnabled:true}},"/controller/wireguardEnabled"],
  ["notifications_access",{...valid.notifications_access,activationRole:"engineer"},"/activationRole"],
];

test("reports field paths for cross-field and safety validation failures",()=>{
  for(const [section,payload,path] of invalidCases){
    const result=validateConfiguration(section,payload);
    assert.equal(result.valid,false,section);
    assert.ok(result.errors.some(error=>error.path===path),`${section} did not report ${path}`);
  }
});

test("rejects Edge secrets and multi-interface gateways",()=>{
  const payload=structuredClone(valid.edge_devices);
  payload.gateways[0].ports.push({interfaceType:"RS485"});
  payload.gateways[0].apiToken="must-not-be-stored";
  const paths=validateConfiguration("edge_devices",payload).errors.map(error=>error.path);
  assert.ok(paths.includes("/gateways/0/ports"));
  assert.ok(paths.includes("/"));
});

test("projects operational fields but excludes PostgreSQL-only economics",()=>{
  const site={openremoteSiteAssetId:"or-site",openremoteStrategyAssetId:"or-strategy"};
  const strategy=buildConfigurationProjection({section:"strategy",revision:4,configuration:valid.strategy},{site,bindings:[]})[0].attributes;
  assert.equal(strategy.configurationMinimumNetSpreadEurPerMwh,15);
  assert.equal(strategy.configurationTrackChargeOrigin,true);

  const battery=buildConfigurationProjection({section:"battery_pcs",revision:4,configuration:valid.battery_pcs},{site,bindings:[{section:"battery_pcs",localResourceType:"battery_system",localResourceId:"bess-1",openremoteAssetId:"or-bess"}]})[0].attributes;
  assert.equal(battery.configurationChargeEfficiencyPct,96);
  assert.equal("assetValueEur" in battery,false);
  assert.equal("warrantedCycles" in battery,false);
});

test("projects PV geometry through trusted bindings",()=>{
  const configuration={arrays:[{...valid.pv.arrays[0],orientationProfile:"east_west",eastWestSplitPct:{east:45,west:55},latitude:42.6,longitude:23.4}]};
  const operation=buildConfigurationProjection({section:"pv",revision:2,configuration},{site:{openremoteSiteAssetId:"or-site",openremoteStrategyAssetId:"or-strategy"},bindings:[{section:"pv",localResourceType:"pv_array",localResourceId:"pv-1",openremoteAssetId:"or-pv"}]})[0];
  assert.equal(operation.assetId,"or-pv");
  assert.equal(operation.attributes.configurationEastSharePct,45);
  assert.equal(operation.attributes.configurationLatitudeOverride,42.6);
});
