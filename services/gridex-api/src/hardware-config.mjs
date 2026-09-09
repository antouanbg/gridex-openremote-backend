import { ApiError } from "./errors.mjs";

const HARDWARE_MODELS = new Set(["rock-pi-e", "olimex-esp32-evb-ea-ind", "olimex-esp32-evb-lab"]);
const ROLES = new Set(["controller", "device-node"]);
const TRANSPORTS = new Set(["ethernet", "modbus-tcp", "rs485", "can", "ocpp", "mqtt"]);

const cleanText = (value, field) => {
  if (typeof value !== "string" || !value.trim()) throw new ApiError(400, "invalid_hardware_configuration", `${field} is required.`);
  return value.trim();
};

export function validateHardwareConfiguration(input) {
  if (!input || typeof input !== "object" || !Array.isArray(input.gateways) || input.gateways.length === 0) {
    throw new ApiError(400, "invalid_hardware_configuration", "At least one gateway is required.");
  }
  const ids = new Set();
  const portIds = new Set();
  const gateways = input.gateways.map((gateway, gatewayIndex) => {
    const id = gateway.id || undefined;
    if (id && ids.has(id)) throw new ApiError(400, "duplicate_gateway", "Gateway identifiers must be unique.");
    if (id) ids.add(id);
    const hardwareModel = cleanText(gateway.hardwareModel, `gateways[${gatewayIndex}].hardwareModel`);
    const role = cleanText(gateway.role, `gateways[${gatewayIndex}].role`);
    if (!HARDWARE_MODELS.has(hardwareModel) || !ROLES.has(role)) {
      throw new ApiError(400, "unsupported_gateway", "The gateway model or role is not supported.");
    }
    const ports = (gateway.ports || []).map((port, portIndex) => {
      if (port.id && portIds.has(port.id)) throw new ApiError(400, "duplicate_gateway_port", "Gateway port identifiers must be unique.");
      if (port.id) portIds.add(port.id);
      const transport = cleanText(port.transport, `gateways[${gatewayIndex}].ports[${portIndex}].transport`);
      if (!TRANSPORTS.has(transport)) throw new ApiError(400, "unsupported_transport", `Unsupported transport: ${transport}.`);
      return {
        id: port.id || undefined,
        name: cleanText(port.name, `gateways[${gatewayIndex}].ports[${portIndex}].name`),
        transport,
        channel: cleanText(port.channel, `gateways[${gatewayIndex}].ports[${portIndex}].channel`),
        settings: port.settings && typeof port.settings === "object" ? port.settings : {},
      };
    });
    return {
      id,
      name: cleanText(gateway.name, `gateways[${gatewayIndex}].name`),
      hardwareModel,
      role,
      managementNetwork: gateway.managementNetwork && typeof gateway.managementNetwork === "object" ? gateway.managementNetwork : {},
      ports,
    };
  });
  const controllers = gateways.filter((gateway) => gateway.role === "controller");
  if (controllers.length !== 1 || controllers[0].hardwareModel !== "rock-pi-e") {
    throw new ApiError(400, "invalid_controller", "Exactly one ROCK Pi E controller is required.");
  }
  for (const gateway of gateways.filter((item) => item.role === "device-node")) {
    if (!gateway.hardwareModel.startsWith("olimex-esp32-evb")) {
      throw new ApiError(400, "invalid_device_node", "Device nodes must use the OLIMEX ESP32-EVB family.");
    }
    const devicePorts = gateway.ports.filter((port) => port.transport === "can" || port.transport === "rs485");
    if (devicePorts.length !== 1) {
      throw new ApiError(400, "invalid_device_bus", "Each OLIMEX node requires exactly one CAN or RS485 device port.");
    }
  }
  return { gateways };
}

export const SUPPORTED_HARDWARE = Object.freeze({
  controller: ["rock-pi-e"],
  nodes: ["olimex-esp32-evb-ea-ind", "olimex-esp32-evb-lab"],
  transports: [...TRANSPORTS],
  assignmentRule: "one-device-per-gateway",
  controlPath: "openremote-vpn-rock-pi-e-ethernet-node-device",
  telemetryPath: "node-ethernet-site-router-vpn-mqtt",
});
