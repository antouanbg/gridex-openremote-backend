import {ApiError} from './errors.mjs';

// Acquisition/publication are edge settings, never implied by storing history.
export function validateTelemetryProfile(input, allowedMetrics) {
  const fail=()=>{throw new ApiError(400,'invalid_telemetry_profile','Select supported metrics and valid per-device periods.');};
  if(!input||input.schemaVersion!==1||!Array.isArray(input.metrics)||!input.metrics.length||input.metrics.length>128)fail();
  const period=value=>value===null||(Number.isInteger(value)&&value>=1&&value<=86400);
  if(!period(input.measurementPeriodSeconds)||!period(input.publishPeriodSeconds)||!period(input.heartbeatPeriodSeconds))fail();
  if(input.measurementPeriodSeconds&&input.publishPeriodSeconds&&input.publishPeriodSeconds<input.measurementPeriodSeconds)fail();
  if(!['all_received','last_per_interval'].includes(input.historyMode))fail();
  if(input.historyMode==='last_per_interval'&&(!Number.isInteger(input.historyPeriodSeconds)||input.historyPeriodSeconds<1||input.historyPeriodSeconds>86400))fail();
  const seen=new Set();
  for(const metric of input.metrics){if(!allowedMetrics.includes(metric)||seen.has(metric))fail();seen.add(metric);}
  return {schemaVersion:1,metrics:[...seen],measurementPeriodSeconds:input.measurementPeriodSeconds,
    publishPeriodSeconds:input.publishPeriodSeconds,heartbeatPeriodSeconds:input.heartbeatPeriodSeconds,
    historyMode:input.historyMode,historyPeriodSeconds:input.historyMode==='all_received'?null:input.historyPeriodSeconds};
}

export function historyMeta(enabled=true){
  return {accessRestrictedRead:true,readOnly:true,storeDataPoints:enabled};
}

export function defaultTelemetryProfile(metrics){
  return validateTelemetryProfile({schemaVersion:1,metrics,measurementPeriodSeconds:null,
    publishPeriodSeconds:null,heartbeatPeriodSeconds:null,historyMode:'all_received',historyPeriodSeconds:null},metrics);
}
