import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultTelemetryProfile,validateTelemetryProfile} from '../src/telemetry-profile.mjs';
import {DEVICE_TYPES,buildOpenRemoteAsset,validateDeviceInput} from '../src/asset-blueprints.mjs';
test('per-device periods are independent and no global 15 minute default exists',()=>{
 const p=defaultTelemetryProfile(['temperatureC']);assert.equal(p.historyMode,'all_received');assert.equal(p.publishPeriodSeconds,null);
 for(const seconds of [10,60,900,3600])assert.equal(validateTelemetryProfile({...p,historyMode:'last_per_interval',historyPeriodSeconds:seconds},p.metrics).historyPeriodSeconds,seconds);
 assert.throws(()=>validateTelemetryProfile({...p,metrics:['password']},p.metrics));
 assert.throws(()=>validateTelemetryProfile({...p,publishPeriodSeconds:0},p.metrics));
});
test('selected history metrics do not enable commands or fake missing readings',()=>{
 const profile=defaultTelemetryProfile(['temperatureC']);
 const device={id:'test',type:'battery',name:'test',manufacturer:'test',model:'test',driverKey:'test',protocol:'test',connection:{telemetryProfile:profile}};
 const a=buildOpenRemoteAsset(device,{openremoteRealm:'test'});
 assert.equal(a.attributes.temperatureC.meta.storeDataPoints,true);
 assert.equal(a.attributes.socPct.meta.storeDataPoints,false);
 assert.equal(a.attributes.online.value,null);
 assert.throws(()=>validateDeviceInput({...device,connection:{telemetryProfile:{...profile,metrics:['requestedPowerLimitPct']}}}),{code:'invalid_telemetry_profile'});
 assert.throws(()=>buildOpenRemoteAsset({...device,connection:{telemetryProfile:{...profile,historyMode:'last_per_interval',historyPeriodSeconds:60}}},{openremoteRealm:'test'}),{code:'history_policy_not_supported'});
});
test('all equipment blueprints store measurements, never commands, as OR metadata maps',()=>{
 for(const type of DEVICE_TYPES){const a=buildOpenRemoteAsset({id:'test',type,name:'test',connection:{}},{openremoteRealm:'test'});
 assert.ok(a.attributes.gridexTelemetryProfile.value.metrics.length);
 for(const x of Object.values(a.attributes))assert.equal(Array.isArray(x.meta),false);
 for(const [name,x] of Object.entries(a.attributes))if(name.startsWith('requested'))assert.notEqual(x.meta.storeDataPoints,true);
 }
});
