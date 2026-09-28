// The legacy installer hard-coded novacom and would regress future customer
// logins. The versioned proxy template now owns safe dynamic realm routing.
export function addCustomerRealms() {
  throw new Error('Legacy customer realm installer is disabled; use the versioned proxy template');
}
