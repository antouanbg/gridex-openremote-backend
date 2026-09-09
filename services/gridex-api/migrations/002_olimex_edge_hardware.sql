BEGIN;

-- Upgrade installations created before the OLIMEX ESP32-EVB-only node
-- decision. Fresh deployments receive the same constraints from 001.
ALTER TABLE gateways
  DROP CONSTRAINT IF EXISTS gateways_role_check;
ALTER TABLE gateways
  ADD CONSTRAINT gateways_role_check
  CHECK (role IN ('controller', 'device-node'));

ALTER TABLE gateway_ports
  DROP CONSTRAINT IF EXISTS gateway_ports_transport_check;
ALTER TABLE gateway_ports
  ADD CONSTRAINT gateway_ports_transport_check
  CHECK (transport IN ('ethernet', 'modbus-tcp', 'rs485', 'can', 'ocpp', 'mqtt'));

COMMIT;
