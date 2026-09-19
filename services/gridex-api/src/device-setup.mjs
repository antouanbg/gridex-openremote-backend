import { ApiError } from './errors.mjs';

// Planning identities only: selecting equipment does not certify its driver.
export const DEVICE_SETUP_TARGETS = ['backend', 'deye-100kw', 'suntech-261'];
export function validateDeviceSetup(input, topology) {
  const fail = () => { throw new ApiError(400, 'invalid_device_setup', 'Select a registered device and one or two compatible communication roles.'); };
  if (!input || !Array.isArray(input.devices) || input.devices.length > topology.gateways.length) fail();
  const ids = new Set();
  const devices = input.devices.map(item => {
    if (!item || typeof item !== 'object') fail();
    const gateway = topology.gateways.find(g => g.id === item.gatewayId);
    if (!gateway || ids.has(item.gatewayId) || !Array.isArray(item.roles) || item.roles.length < 1 || item.roles.length > 2) fail();
    ids.add(item.gatewayId);
    const targets = new Set();
    const roles = item.roles.map(role => {
      if (!role || typeof role !== 'object') fail();
      if (!DEVICE_SETUP_TARGETS.includes(role.target) || targets.has(role.target)) fail();
      targets.add(role.target);
      if (role.target === 'backend') {
        if (gateway.role !== 'controller' || role.kind !== 'backend' || role.transport !== 'ethernet') fail();
      } else if (role.kind !== 'equipment' || !['rs485', 'modbus-tcp'].includes(role.transport)) fail();
      return { kind: role.kind, target: role.target, transport: role.transport };
    });
    return { gatewayId: item.gatewayId, roles };
  });
  return { schemaVersion: 1, lifecycle: 'draft', devices };
}
