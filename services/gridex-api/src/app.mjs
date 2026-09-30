import { randomUUID } from "node:crypto";
import {authoritativeSites,authoritativeTopology} from './inventory.mjs';
import { assertAllowedOrigin } from "./config.mjs";
import { requirePermission, withMembershipRoles } from "./auth.mjs";
import { ApiError, toErrorResponse } from "./errors.mjs";
import {requireDeviceAdmin} from './device-vault.mjs';
import {heartbeatStatuses} from './device-heartbeats.mjs';
import { validateDeviceSetup } from './device-setup.mjs';
import { buildOpenRemoteAsset, DEVICE_TYPES, validateDeviceInput } from "./asset-blueprints.mjs";
import { normalizeDevice, normalizeSiteSnapshot } from "./normalizers.mjs";
import { SUPPORTED_HARDWARE, validateHardwareConfiguration } from "./hardware-config.mjs";
import { STRATEGY_CODES, validateStrategyConfiguration } from "./strategy-config.mjs";
import { ROCK_METRICS } from "./history-ingest.mjs";
import { createLoginDiscoveryLimit, normaliseLoginEmail } from './login-discovery.mjs';
import {idempotencyKey,provisionGateway,provisionSite} from './inventory-provisioning.mjs';
import { MARKET_ZONES } from './market-prices.mjs';
import { grafanaTimeRange } from './grafana-range.mjs';

const CONFIGURATION_SECTIONS = new Set(["battery-asset", "tariff", "forecast", "grid", "evse", "notifications", "trader-schedule", "balancing"]);
const STRATEGY_CATALOG = STRATEGY_CODES.map((code) => ({
  code,
  label: { en: code.split("_").map((part) => part[0].toUpperCase() + part.slice(1)).join(" "), bg: code },
  description: { en: "Versioned site strategy with validation and simulation before activation.", bg: "Версионирана стратегия с проверка и симулация преди активиране." },
  requiredCapabilities: code === "manual" ? ["control"] : ["telemetry", "control"],
  requiredRoles: code === "manual" ? ["operator"] : ["operator", "energy_manager"],
  simulationRequired: code !== "manual",
}));

function cors(res, config, origin) {
  if (origin && config.allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, If-Match, Idempotency-Key");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, OPTIONS");
  res.setHeader("Access-Control-Expose-Headers", "ETag, X-Request-Id");
}

async function json(res, status, body, context) {
  if (status < 400) await context.checkAccess?.();
  const payload = JSON.stringify(body);
  cors(res, context.config, context.origin);
  res.setHeader("X-Request-Id", context.requestId);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function readJson(req, maximumBytes) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maximumBytes) throw new ApiError(413, "request_too_large", "The request body is too large.");
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); }
  catch { throw new ApiError(400, "invalid_json", "The request body is not valid JSON."); }
}

function expectedRevision(req) {
  const raw = req.headers["if-match"];
  const value = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(value) || value < 0) throw new ApiError(428, "revision_required", "If-Match with the current numeric revision is required.");
  return value;
}

function publicSite(site) {
  return { id: site.id, organisationId: site.organisationId, name: site.name, timezone: site.timezone, marketCode: site.marketCode, status: site.status };
}

function publicDeviceConfiguration(device) {
  return {
    id: device.id, siteId: device.siteId, parentDeviceId: device.parentDeviceId, gatewayId: device.gatewayId, gatewayPortId: device.gatewayPortId,
    type: device.type, name: device.name, manufacturer: device.manufacturer, model: device.model,
    serialNumber: device.serialNumber, driverKey: device.driverKey, protocol: device.protocol,
    status: device.status, revision: device.revision,
  };
}

function canonicalStrategyDraft(row, siteId) {
  return {
    siteId, draftId: row.id, baseRevision: Number(row.base_revision ?? 0), revision: Number(row.revision),
    etag: String(row.revision), lifecycle: row.lifecycle, configuration: row.configuration,
    validation: row.validation || { valid: false, errors: [], warnings: [] },
    createdAt: row.created_at || new Date().toISOString(), createdBy: row.created_by || "",
  };
}

function canonicalStrategyVersion(row, siteId) {
  return row ? {
    siteId, revision: Number(row.revision), etag: String(row.revision), lifecycle: row.lifecycle,
    configuration: row.configuration, createdAt: row.created_at || new Date().toISOString(),
    createdBy: row.created_by || "", appliedAt: row.applied_at || row.appliedAt || null,
  } : null;
}

function normalizeDatapoints(result) {
  const items = Array.isArray(result) ? result : Array.isArray(result?.datapoints) ? result.datapoints : [];
  return items.filter((point) => Number.isFinite(Number(point?.x)) && Number.isFinite(Number(point?.y)))
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }));
}

async function loadSiteDevices(site, repository, openRemote) {
  const devices = await repository.listDevices(site.id);
  const configured = devices.filter((device) => device.openremoteAssetId);
  const assets = await openRemote.getManagedAssets(configured.map((device) => device.openremoteAssetId));
  return configured.map((device, index) => normalizeDevice(device, assets[index]));
}

async function loadDeviceRecords(site, repository, openRemote) {
  const devices = await repository.listDevices(site.id);
  const configured = devices.filter((device) => device.openremoteAssetId);
  const assets = await openRemote.getManagedAssets(configured.map((device) => device.openremoteAssetId));
  const liveByDeviceId = new Map(configured.map((device, index) => [device.id, normalizeDevice(device, assets[index])]));
  return devices.map((device) => ({ ...publicDeviceConfiguration(device), live: liveByDeviceId.get(device.id) || null }));
}

async function loadSnapshot(site, repository, openRemote) {
  const devices = await loadSiteDevices(site, repository, openRemote);
  const [strategy, control, batteryEconomicsToday] = await Promise.all([
    site.openremoteStrategyAssetId ? openRemote.getManagedAsset(site.openremoteStrategyAssetId) : null,
    site.openremoteControlAssetId ? openRemote.getManagedAsset(site.openremoteControlAssetId) : null,
    repository.getDailyBatteryEconomics(site.id),
  ]);
  return { ...normalizeSiteSnapshot(site, devices, strategy, control), batteryEconomicsToday };
}

export function createApp({ config, authenticate, repository, openRemote, invitations, onboarding, organisationAccess, deviceVault, deviceHeartbeats, heartbeatSubscriptions, managerLaunch, grafanaLaunch, market, serviceEntitlements, serviceRequests, contactInquiries }) {
  const limitLoginDiscovery = createLoginDiscoveryLimit();
  return async function app(req, res) {
    const requestId = req.headers["x-request-id"]?.toString().slice(0, 128) || randomUUID();
    const origin = req.headers.origin;
    const context = { config, origin, requestId };
    try {
      assertAllowedOrigin(config, origin);
      if (req.method === "OPTIONS") { cors(res, config, origin); res.writeHead(204); return res.end(); }
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

      if (url.pathname === '/api/v1/contact/challenge' && req.method === 'GET') {
        if (!origin || !config.allowedOrigins.has(origin)) throw new ApiError(403, 'origin_not_allowed', 'This web origin is not allowed.');
        if (!contactInquiries) throw new ApiError(503, 'contact_unavailable', 'Enquiries are unavailable.');
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, contactInquiries.challenge(), context);
      }
      if (url.pathname === '/api/v1/contact/inquiries' && req.method === 'POST') {
        if (!origin || !config.allowedOrigins.has(origin)) throw new ApiError(403, 'origin_not_allowed', 'This web origin is not allowed.');
        if (!contactInquiries) throw new ApiError(503, 'contact_unavailable', 'Enquiries are unavailable.');
        const body = await readJson(req, Math.min(config.maximumBodyBytes, 8192));
        let identity = null;
        if (req.headers.authorization) {
          identity = await authenticate(req);
          await repository.assertOrganisationAccess?.(identity);
        }
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 202, await contactInquiries.submit(body, identity), context);
      }

      if (url.pathname === '/api/v1/auth/login-realm') {
        if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Use POST for login routing.');
        const body = await readJson(req, Math.min(config.maximumBodyBytes, 1024));
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'email'))
          throw new ApiError(400, 'invalid_login_request', 'Only an email address is accepted.');
        const email = normaliseLoginEmail(body.email);
        limitLoginDiscovery(email);
        const known = await repository.findLoginRealms(email);
        const realms = known.length ? known : [config.realm];
        if (realms.some(realm => !/^[a-z][a-z0-9-]{2,30}$/.test(realm)))
          throw new ApiError(503, 'login_routing_unavailable', 'Login routing is unavailable.');
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, { realms }, context);
      }

      if (url.pathname === '/api/v1/auth/resend-invitation') {
        if (req.method !== 'POST') throw new ApiError(405, 'method_not_allowed', 'Use POST for invitation resend.');
        const body = await readJson(req, Math.min(config.maximumBodyBytes, 1024));
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'email'))
          throw new ApiError(400, 'invalid_resend_request', 'Only an email address is accepted.');
        const email = normaliseLoginEmail(body.email);
        limitLoginDiscovery(email);
        await Promise.all([onboarding?.resendToRecipient(email), invitations?.resendToRecipient(email)]);
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 202, { status: 'accepted' }, context);
      }

      if (url.pathname.startsWith('/internal/manager/')) {
        if (!managerLaunch) throw new ApiError(503, 'manager_unavailable', 'Manager access is not configured.');
        if (url.pathname === '/internal/manager/consume' && req.method === 'GET') {
          const result = await managerLaunch.consume(url.searchParams.get('ticket'));
          res.setHeader('Set-Cookie', result.cookie);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Referrer-Policy', 'no-referrer');
          res.writeHead(303, { Location: `${config.managerPublicOrigin}/manager/?realm=${encodeURIComponent(result.realm)}` });
          return res.end();
        }
        if (req.method === 'GET' && ['/internal/manager/check', '/internal/manager/config', '/internal/manager/info'].includes(url.pathname)) {
          const realm = await managerLaunch.check(req.headers.cookie, req.headers['x-original-uri']);
          res.setHeader('Cache-Control', 'no-store');
          if (url.pathname.endsWith('/check')) {
            res.setHeader('X-Gridex-Realm', realm);
            res.writeHead(204); return res.end();
          }
          if (url.pathname.endsWith('/info')) return json(res, 200, { version: '1.30.0', authServerUrl: '/auth' }, context);
          return json(res, 200, { manager: { realm, clientId: 'openremote', managerUrl: config.managerPublicOrigin,
            keycloakUrl: `${config.managerPublicOrigin}/auth`, consoleAutoEnable: false } }, context);
        }
        throw new ApiError(404, 'not_found', 'Manager route not found.');
      }

      if (url.pathname.startsWith('/internal/grafana/')) {
        if (!grafanaLaunch) throw new ApiError(503, 'grafana_unavailable', 'Dashboard access is not configured.');
        if (url.pathname === '/internal/grafana/consume' && req.method === 'GET') {
          const period = grafanaTimeRange(url.searchParams);
          const result = await grafanaLaunch.consume(url.searchParams.get('ticket'));
          res.setHeader('Set-Cookie', result.cookie);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Referrer-Policy', 'no-referrer');
          const dashboard = new URL(`${config.grafanaPublicOrigin}/grafana/d/gridex-market-bg/gridex-market-bg`);
          dashboard.searchParams.set('kiosk', '');
          dashboard.searchParams.set('from', period.from);
          dashboard.searchParams.set('to', period.to);
          res.writeHead(303, { Location: dashboard.toString() });
          return res.end();
        }
        if (url.pathname === '/internal/grafana/check' && req.method === 'GET') {
          const user = await grafanaLaunch.check(req.headers.cookie, req.headers['x-original-uri']);
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('X-Gridex-Grafana-User', user);
          res.writeHead(204); return res.end();
        }
        throw new ApiError(404, 'not_found', 'Dashboard route not found.');
      }

      if (req.method === "GET" && url.pathname === "/health") {
        const online = await openRemote.health();
        return await json(res, online ? 200 : 503, { status: online ? "ready" : "degraded", openRemote: online ? "online" : "offline", writesEnabled: config.writesEnabled }, context);
      }

      const identity = await authenticate(req);
      context.checkAccess = () => repository.assertOrganisationAccess?.(identity);
      await context.checkAccess();
      res.setHeader('Cache-Control', 'no-store');
      const memberships = await repository.getMemberships(identity.subject, identity.realm);
      let principal = withMembershipRoles(identity, memberships.map((m) => m.role), config.platformAdminSubjects, config.realm);

      if (url.pathname === '/api/v1/me/manager-launch' && req.method === 'POST') {
        if (!managerLaunch) throw new ApiError(503, 'manager_unavailable', 'Manager access is not configured.');
        res.setHeader('Cache-Control', 'no-store');
        return json(res, 200, await managerLaunch.issue(principal), context);
      }
      if (url.pathname === '/api/v1/me/grafana-launch' && req.method === 'POST') {
        if (!grafanaLaunch) throw new ApiError(503, 'grafana_unavailable', 'Dashboard access is not configured.');
        return json(res, 200, await grafanaLaunch.issue(principal), context);
      }
      if (url.pathname === '/api/v1/me/manager-access/revoke' && req.method === 'POST') {
        if (managerLaunch) await managerLaunch.revoke(principal.subject, principal.realm);
        if (grafanaLaunch) await grafanaLaunch.revoke(principal.subject, principal.realm);
        res.writeHead(204, { 'Cache-Control': 'no-store' }); return res.end();
      }
      if (url.pathname === '/api/v1/platform/organisations' && req.method === 'GET') {
        requirePermission(principal, 'platform:manage');
        if (!organisationAccess) throw new ApiError(503, 'organisation_access_unavailable', 'Organisation access management is unavailable.');
        return await json(res, 200, { organisations: await organisationAccess.list(principal) }, context);
      }
      if (url.pathname === '/api/v1/platform/services' && req.method === 'GET') {
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service administration is unavailable.');
        return await json(res, 200, { services: await serviceEntitlements.catalog(principal) }, context);
      }
      if (url.pathname === '/api/v1/me/service-catalog' && req.method === 'GET') {
        if (!serviceRequests) throw new ApiError(503, 'services_unavailable', 'Service requests are unavailable.');
        return await json(res, 200, { services: await serviceRequests.catalog(principal) }, context);
      }
      if (url.pathname === '/api/v1/me/service-requests' && ['GET','POST'].includes(req.method)) {
        if (!serviceRequests) throw new ApiError(503, 'services_unavailable', 'Service requests are unavailable.');
        if (req.method === 'GET') return await json(res, 200, { requests: await serviceRequests.list(principal, 'mine') }, context);
        return await json(res, 201, await serviceRequests.create(principal, await readJson(req, 1024)), context);
      }
      if (url.pathname === '/api/v1/platform/service-requests' && req.method === 'GET') {
        if (!serviceRequests) throw new ApiError(503, 'services_unavailable', 'Service requests are unavailable.');
        return await json(res, 200, { requests: await serviceRequests.list(principal, 'platform') }, context);
      }
      const platformRequest = url.pathname.match(/^\/api\/v1\/platform\/service-requests\/([0-9a-f-]{36})\/(approve|reject)$/i);
      if (platformRequest && req.method === 'POST') {
        if (!serviceRequests) throw new ApiError(503, 'services_unavailable', 'Service requests are unavailable.');
        return await json(res, 200, platformRequest[2] === 'approve'
          ? await serviceRequests.approvePlatform(principal, platformRequest[1])
          : await serviceRequests.reject(principal, platformRequest[1], null, (await readJson(req, 1024)).note), context);
      }
      const organisationRequest = url.pathname.match(/^\/api\/v1\/organisations\/([0-9a-f-]{36})\/service-requests(?:\/([0-9a-f-]{36})\/(approve|reject))?$/i);
      if (organisationRequest && (req.method === 'GET' || req.method === 'POST')) {
        if (!serviceRequests) throw new ApiError(503, 'services_unavailable', 'Service requests are unavailable.');
        if (req.method === 'GET' && !organisationRequest[2]) return await json(res, 200,
          { requests: await serviceRequests.list(principal, 'organisation', organisationRequest[1]) }, context);
        if (req.method === 'POST' && organisationRequest[2]) return await json(res, 200,
          organisationRequest[3] === 'approve'
            ? await serviceRequests.approveOrganisation(principal, organisationRequest[1], organisationRequest[2])
            : await serviceRequests.reject(principal, organisationRequest[2], organisationRequest[1],
              (await readJson(req, 1024)).note), context);
      }
      if (url.pathname === '/api/v1/platform/market/zones' && req.method === 'GET') {
        if (!serviceEntitlements || !market) throw new ApiError(503, 'market_not_configured', 'Market administration is unavailable.');
        serviceEntitlements.platform(principal);
        return await json(res, 200, { zones: await market.collectionZones() }, context);
      }
      const collectionZone = url.pathname.match(/^\/api\/v1\/platform\/market\/zones\/([A-Za-z-]{2,32})$/);
      if (collectionZone && req.method === 'PUT') {
        if (!serviceEntitlements || !market) throw new ApiError(503, 'market_not_configured', 'Market administration is unavailable.');
        serviceEntitlements.platform(principal);
        const body = await readJson(req, 512);
        return await json(res, 200, await market.setCollectionZone(body.country, collectionZone[1], body.enabled, principal.subject), context);
      }
      const organisationZone = url.pathname.match(/^\/api\/v1\/platform\/organisations\/([0-9a-f-]{36})\/market-zones(?:\/([A-Za-z-]{2,32}))?$/i);
      if (organisationZone) {
        if (!serviceEntitlements || !market) throw new ApiError(503, 'market_not_configured', 'Market administration is unavailable.');
        if (req.method === 'GET' && !organisationZone[2]) return await json(res, 200,
          { zones: await serviceEntitlements.listOrganisationMarketZones(principal, organisationZone[1], await market.collectionZones()) }, context);
        if (req.method === 'PUT' && organisationZone[2]) {
          serviceEntitlements.platform(principal);
          const body = await readJson(req, 512);
          if (body.enabled && !(await market.isZoneEnabled(body.country, organisationZone[2])))
            throw new ApiError(403, 'market_zone_disabled', 'Enable collection for this zone first.');
          return await json(res, 200, await serviceEntitlements.setOrganisationMarketZone(
            principal, organisationZone[1], body.country, organisationZone[2], body.enabled), context);
        }
      }
      const platformService = url.pathname.match(/^\/api\/v1\/platform\/organisations\/([0-9a-f-]{36})\/services(?:\/([a-z][a-z0-9_]{1,63}))?$/i);
      if (platformService && serviceEntitlements) {
        if (req.method === 'GET' && !platformService[2]) return await json(res, 200,
          { services: await serviceEntitlements.listOrganisation(principal, platformService[1], true) }, context);
        if (req.method === 'PUT' && platformService[2]) return await json(res, 200,
          await serviceEntitlements.setOrganisation(principal, platformService[1], platformService[2],
            (await readJson(req, 512)).enabled), context);
      }
      const memberService = url.pathname.match(/^\/api\/v1\/organisations\/([0-9a-f-]{36})\/services(?:\/([a-z][a-z0-9_]{1,63})\/members(?:\/([^/]+))?)?$/i);
      if (memberService && serviceEntitlements) {
        if (req.method === 'GET' && !memberService[2]) return await json(res, 200,
          { services: await serviceEntitlements.listOrganisation(principal, memberService[1]) }, context);
        if (req.method === 'GET' && memberService[2] && !memberService[3]) return await json(res, 200,
          { members: await serviceEntitlements.listMembers(principal, memberService[1], memberService[2]) }, context);
        if (req.method === 'PUT' && memberService[2] && memberService[3]) return await json(res, 200,
          await serviceEntitlements.setMember(principal, memberService[1], memberService[2],
            decodeURIComponent(memberService[3]), (await readJson(req, 512)).enabled), context);
      }
      const organisationAccessRoute = url.pathname.match(/^\/api\/v1\/platform\/organisations\/([0-9a-f-]{36})\/(access|delivery)$/i);
      if (organisationAccessRoute && req.method === 'POST') {
        requirePermission(principal, 'platform:manage');
        if (!organisationAccess) throw new ApiError(503, 'organisation_access_unavailable', 'Organisation access management is unavailable.');
        const result = organisationAccessRoute[2] === 'access'
          ? await organisationAccess.change(principal, organisationAccessRoute[1], await readJson(req, 2048))
          : await organisationAccess.checkDelivery(principal, organisationAccessRoute[1]);
        return await json(res, 200, result, context);
      }

      if (url.pathname === '/api/v1/platform/organisation-invitations' && req.method === 'POST') {
        if (!onboarding) throw new ApiError(503, 'realm_setup_unavailable', 'New organisation invitations are not configured.');
        return await json(res, 201, await onboarding.create(principal, await readJson(req, config.maximumBodyBytes)), context);
      }
      if (url.pathname === '/api/v1/platform/organisation-invitations' && req.method === 'GET') {
        if (!principal.permissions.includes('platform:manage')) throw new ApiError(403, 'permission_denied', 'Platform administrator required.');
        return await json(res, 200, { enabled: Boolean(onboarding), invitations: onboarding ? await onboarding.listCreated(principal) : [] }, context);
      }
      const revokeOrganisation = url.pathname.match(/^\/api\/v1\/platform\/organisation-invitations\/([0-9a-f-]{36})\/revoke$/i);
      if (revokeOrganisation && req.method === 'POST') {
        if (!onboarding) throw new ApiError(503, 'realm_setup_unavailable', 'New organisation invitations are not configured.');
        return await json(res, 200, await onboarding.revoke(principal, revokeOrganisation[1]), context);
      }
      const resendOrganisation = url.pathname.match(/^\/api\/v1\/platform\/organisation-invitations\/([0-9a-f-]{36})\/resend$/i);
      if (resendOrganisation && req.method === 'POST') {
        if (!onboarding) throw new ApiError(503, 'realm_setup_unavailable', 'New organisation invitations are not configured.');
        return await json(res, 200, await onboarding.resend(principal, resendOrganisation[1]), context);
      }
      if (url.pathname === '/api/v1/me/organisation-onboarding' && req.method === 'GET') {
        if (!onboarding) return await json(res, 200, { invitations: [] }, context);
        return await json(res, 200, { invitations: await onboarding.list(principal) }, context);
      }
      const acceptOrganisation = url.pathname.match(/^\/api\/v1\/organisation-onboarding\/([0-9a-f-]{36})\/accept$/i);
      if (acceptOrganisation && req.method === 'POST') {
        if (!onboarding) throw new ApiError(503, 'realm_setup_unavailable', 'New organisation invitations are not configured.');
        return await json(res, 200, await onboarding.accept(principal, acceptOrganisation[1]), context);
      }

      if (url.pathname.includes('/invitations')) {
        if (!invitations) throw new ApiError(503, 'enrollment_unavailable', 'Email enrollment is not configured.');
        const orgRoute = url.pathname.match(/^\/api\/v1\/organisations\/([0-9a-f-]{36})\/invitations(?:\/([0-9a-f-]{36})\/(revoke|resend))?$/i);
        if (orgRoute && req.method === 'GET' && !orgRoute[2])
          return await json(res, 200, { invitations: await invitations.listCreated(identity, orgRoute[1]) }, context);
        if (orgRoute && req.method === 'POST') {
          const result = orgRoute[3] === 'revoke' ? await invitations.revoke(identity, orgRoute[1], orgRoute[2])
            : orgRoute[3] === 'resend' ? await invitations.resend(identity, orgRoute[1], orgRoute[2])
            : await invitations.create(identity, orgRoute[1], await readJson(req, config.maximumBodyBytes));
          return await json(res, orgRoute[2] ? 200 : 201, result, context);
        }
        if (url.pathname === '/api/v1/me/invitations' && req.method === 'GET') {
          return await json(res, 200, { invitations: await invitations.list(identity) }, context);
        }
        const accept = url.pathname.match(/^\/api\/v1\/invitations\/([0-9a-f-]{36})\/accept$/i);
        if (accept && req.method === 'POST') return await json(res, 200, await invitations.accept(identity, accept[1]), context);
        throw new ApiError(404, 'not_found', 'Invitation route not found.');
      }

      if (req.method === "GET" && url.pathname === "/api/v1/me") {
        await repository.recordAuthenticatedLogin?.(identity);
        return await json(res, 200, {
          subject: principal.subject, realm: principal.realm, email: principal.email, name: principal.name,
          preferredUsername: principal.preferredUsername, roles: principal.roles, permissions: principal.permissions,
          memberships,
        }, context);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/me/services') {
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service administration is unavailable.');
        return await json(res, 200, { services: await serviceEntitlements.mine(principal) }, context);
      }

      if (req.method === 'GET' && url.pathname === '/api/v1/market/services') {
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service administration is unavailable.');
        serviceEntitlements.platform(principal);
        return await json(res, 200, { services: [{ id: 'day_ahead', label: 'Day-ahead', provider: 'ENTSO-E' }],
          zones: MARKET_ZONES }, context);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/market/status') {
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service administration is unavailable.');
        serviceEntitlements.platform(principal);
        if (!market) throw new ApiError(503, 'market_not_configured', 'Market archive is not configured.');
        return await json(res, 200, { provider: 'ENTSO-E', zones: await market.status() }, context);
      }
      if (req.method === 'GET' && url.pathname === '/api/v1/market/prices') {
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service administration is unavailable.');
        serviceEntitlements.platform(principal);
        if (!market) throw new ApiError(503, 'market_not_configured', 'The market provider is not configured.');
        return await json(res, 200, await market.prices({
          country: url.searchParams.get('country'), zone: url.searchParams.get('zone'),
          date: url.searchParams.get('date'), service: url.searchParams.get('service'),
        }), context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/me/preferences") {
        return await json(res, 200, await repository.getUserPreferences(principal.subject), context);
      }

      if (['/api/v1/me/email-notifications','/api/v1/me/heartbeat-email'].includes(url.pathname) && ['GET','PUT'].includes(req.method)) {
        if(!heartbeatSubscriptions)throw new ApiError(503,'notifications_unavailable','Email notifications are not configured.');
        res.setHeader('Cache-Control','no-store');
        if(req.method==='GET')return await json(res,200,await heartbeatSubscriptions.get(principal),context);
        const input=await readJson(req,1024);
        const result=await heartbeatSubscriptions.set(principal,input?.enabled);
        await repository.audit({principal,action:result.enabled?'email.notifications.enabled':'email.notifications.disabled',
          resourceType:'notification_preference',resourceId:principal.subject,result:'success',requestId});
        return await json(res,200,result,context);
      }

      if (req.method === "PUT" && url.pathname === "/api/v1/me/preferences") {
        const input = await readJson(req, config.maximumBodyBytes);
        const updated = await repository.updateUserPreferences(principal.subject, input, expectedRevision(req));
        res.setHeader("ETag", String(updated.revision));
        return await json(res, 200, updated, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/device-types") {
        requirePermission(principal, "asset:read");
        return await json(res, 200, { items: DEVICE_TYPES, hardware: SUPPORTED_HARDWARE }, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/strategies/catalog") {
        requirePermission(principal, "strategy:read");
        return await json(res, 200, { items: STRATEGY_CATALOG }, context);
      }

      if (req.method === "GET" && url.pathname === "/api/v1/sites") {
        requirePermission(principal, "site:read");
        const sites = await authoritativeSites(await repository.listAccessibleSites(principal.subject,principal.realm),openRemote,principal.subject,{realm:principal.realm,token:principal.accessToken});
        res.setHeader('Cache-Control','no-store');
        return await json(res, 200, { sites: sites.map(publicSite) }, context);
      }

      if (req.method === 'POST' && url.pathname === '/api/v1/sites') {
        const site=await provisionSite({repository,remote:openRemote,principal,key:idempotencyKey(req),
          input:await readJson(req,config.maximumBodyBytes)});
        await repository.audit({principal,siteId:site.id,action:'site.provisioned',resourceType:'site',resourceId:site.id,result:'success',requestId});
        return json(res,201,publicSite(site),context);
      }

      const siteRoute = url.pathname.match(/^\/api\/v1\/sites\/([^/]+)(\/.*)?$/);
      if (!siteRoute) throw new ApiError(404, "not_found", "The requested API route does not exist.");
      const siteId = decodeURIComponent(siteRoute[1]);
      const suffix = siteRoute[2] || "";
      const site = await repository.requireSite(principal.subject, siteId, principal.realm);
      principal = withMembershipRoles(identity, [site.membershipRole]);

      if(req.method==='POST'&&suffix==='/gateways'){
        const gateway=await provisionGateway({repository,remote:openRemote,principal,site,key:idempotencyKey(req),
          input:await readJson(req,config.maximumBodyBytes)});
        await repository.audit({principal,siteId,action:'gateway.provisioned',resourceType:'gateway',resourceId:gateway.id,result:'success',requestId,
          details:{hardwareModel:gateway.hardwareModel}});
        return json(res,201,{id:gateway.id,siteId,name:gateway.name,hardwareModel:gateway.hardwareModel,role:gateway.role},context);
      }

      const accessRoute=suffix.match(/^\/gateways\/([0-9a-f-]{36})\/access$/i);
      if(accessRoute && ['GET','PUT'].includes(req.method)) {
        requireDeviceAdmin(site,principal);
        if(!deviceVault) throw new ApiError(503,'vault_unavailable','Device credential storage is not configured.');
        const topology=await repository.getTopology(site.id);
        const gateway=topology.gateways.find(g=>g.id===accessRoute[1]);
        if(!gateway)throw new ApiError(404,'not_found','Gateway not found.');
        if(gateway.role!=='controller')throw new ApiError(400,'rockpi_only','Access to ESP32 must go through ROCK Pi.');
        res.setHeader('Cache-Control','no-store');
        if(req.method==='GET')return await json(res,200,await deviceVault.status(site.id,gateway.id),context);
        const result=await deviceVault.store(site.id,gateway.id,await readJson(req,24576));
        await repository.audit({principal,siteId,action:'gateway.credential.replaced',resourceType:'gateway',resourceId:gateway.id,result:'success',requestId,details:{version:result.version}});
        return await json(res,200,result,context);
      }

      if (req.method === "GET" && suffix === "/hardware") {
        requirePermission(principal, 'site:read');
        const topology = await authoritativeTopology(site,repository,openRemote,principal.subject,{realm:principal.realm,token:principal.accessToken});
        res.setHeader('Cache-Control','no-store');
        return await json(res, 200, { ...topology, devices: topology.devices.map(publicDeviceConfiguration) }, context);
      }

      if (req.method === 'GET' && suffix === '/device-heartbeats') {
        requirePermission(principal, 'site:read');
        await authoritativeSites([site], openRemote, principal.subject,{realm:principal.realm,token:principal.accessToken}).then(items => {
          if (items.length !== 1) throw new ApiError(403, 'permission_denied', 'OpenRemote Site access is required.');
        });
        res.setHeader('Cache-Control', 'no-store');
        if (!deviceHeartbeats) throw new ApiError(503, 'heartbeat_unavailable', 'Heartbeat ingestion is not configured.');
        return await json(res, 200, { items: heartbeatStatuses(await deviceHeartbeats.list(site.id),
          Date.now(), config.heartbeatStaleMs, config.heartbeatOfflineMs) }, context);
      }

      if (req.method === 'GET' && suffix === '/history') {
        requireDeviceAdmin(site, principal);
        const now = Date.now();
        const from = Number(url.searchParams.get('from')) || now - 24 * 60 * 60 * 1000;
        const to = Number(url.searchParams.get('to')) || now;
        if (!Number.isFinite(from) || !Number.isFinite(to) || from < now - config.historyMaximumRangeMs || to < from || to > now + 5000) {
          throw new ApiError(400, 'invalid_history_range', 'History range is invalid or exceeds the configured maximum.');
        }
        const requestedMetric = url.searchParams.get('metric');
        if (requestedMetric && !ROCK_METRICS[requestedMetric]) throw new ApiError(400, 'invalid_history_metric', 'The requested telemetry metric is not supported.');
        const bindings = config.historyBindings.filter((binding) => binding.siteId === site.id && (!requestedMetric || binding.metric === requestedMetric));
        const linked = await openRemote.getUserLinkedAssets(bindings.map((binding) => binding.assetId), principal.subject);
        const linkedIds = new Set(linked.map((asset) => asset.id));
        const items = await Promise.all(bindings.filter((binding) => linkedIds.has(binding.assetId)).map(async (binding) => ({
          assetId: binding.assetId, metric: binding.metric, unit: ROCK_METRICS[binding.metric].unit,
          points: normalizeDatapoints(await openRemote.getDatapoints(binding.assetId, binding.metric, { fromTimestamp: from, toTimestamp: to })),
        })));
        return await json(res, 200, { from, to, items }, context);
      }

      if (req.method === 'GET' && suffix === '/visualisations/history') {
        requirePermission(principal, 'site:read');
        if (!serviceEntitlements) throw new ApiError(503, 'services_unavailable', 'Service access is unavailable.');
        await serviceEntitlements.requireSiteVisualisations(principal, site.organisationId);
        const authoritative = await authoritativeSites([site], openRemote, principal.subject,
          { realm: principal.realm, token: principal.accessToken });
        if (authoritative.length !== 1) throw new ApiError(403, 'permission_denied', 'OpenRemote Site access is required.');
        const now = Date.now();
        const fromParam = url.searchParams.get('from');
        const toParam = url.searchParams.get('to');
        const from = fromParam === null ? now - 24 * 60 * 60 * 1000 : Number(fromParam);
        const to = toParam === null ? now : Number(toParam);
        if (!Number.isFinite(from) || !Number.isFinite(to) || from < now - config.historyMaximumRangeMs ||
          to < from || to > now + 5000)
          throw new ApiError(400, 'invalid_history_range', 'History range is invalid or exceeds the configured maximum.');
        const bindings = config.historyBindings.filter(binding => binding.siteId === site.id);
        const linked = await openRemote.getUserLinkedAssets(bindings.map(binding => binding.assetId),
          principal.subject, { realm: principal.realm, token: principal.accessToken });
        const linkedIds = new Set(linked.map(asset => asset.id));
        const items = await Promise.all(bindings.filter(binding => linkedIds.has(binding.assetId)).map(async binding => ({
          assetId: binding.assetId, metric: binding.metric, unit: ROCK_METRICS[binding.metric].unit,
          points: normalizeDatapoints(await openRemote.getDatapoints(binding.assetId, binding.metric,
            { fromTimestamp: from, toTimestamp: to })).filter(point => point.x >= from && point.x <= to &&
              point.y >= ROCK_METRICS[binding.metric].minimum && point.y <= ROCK_METRICS[binding.metric].maximum),
        })));
        await serviceEntitlements.requireSiteVisualisations(principal, site.organisationId);
        if ((await authoritativeSites([site], openRemote, principal.subject,
          { realm: principal.realm, token: principal.accessToken })).length !== 1)
          throw new ApiError(403, 'permission_denied', 'OpenRemote Site access is required.');
        res.setHeader('Cache-Control', 'no-store');
        return await json(res, 200, { siteId: site.id, from, to, items }, context);
      }

      if (req.method === "POST" && suffix === "/hardware-configurations") {
        requireDeviceAdmin(site,principal);
        if(site.openremoteRealm!==config.realm)throw new ApiError(409,'use_verified_gateway_provisioning','Customer hardware must be provisioned through OpenRemote-backed gateway selection.');
        const input = validateHardwareConfiguration(await readJson(req, config.maximumBodyBytes));
        const result = await repository.saveHardwareConfiguration(site.id, input, principal.subject);
        await repository.audit({ principal, siteId, action: "hardware.configuration.created", resourceType: "hardware_configuration", resourceId: result.id, result: "success", requestId, details: { revision: result.revision } });
        return await json(res, 201, result, context);
      }

      if (suffix === '/device-setup' && ['GET', 'PUT'].includes(req.method)) {
        requirePermission(principal, 'hardware:manage');
        if (!principal.emailVerified) throw new ApiError(403, 'permission_denied', 'Verified email is required.');
        const topology = await authoritativeTopology(site, repository, openRemote, principal.subject,{realm:principal.realm,token:principal.accessToken});
        res.setHeader('Cache-Control', 'no-store');
        if (req.method === 'GET') return await json(res, 200, {...await repository.getSiteConfiguration(site.id, 'device-setup'), imported: (await repository.getSiteConfiguration(site.id, 'device-import')).configuration}, context);
        const body = await readJson(req, config.maximumBodyBytes);
        if (body.confirmed !== true) throw new ApiError(400, 'confirmation_required', 'Confirm saving the draft.');
        const setup = validateDeviceSetup(body.configuration, topology);
        const saved = await repository.saveSiteConfiguration(site.id, 'device-setup', setup, expectedRevision(req), principal.subject);
        await repository.audit({principal, siteId, action:'device.setup.draft.saved', resourceType:'site_configuration', resourceId:'device-setup', result:'success', requestId, details:{revision:saved.revision}});
        return await json(res, 200, saved, context);
      }

      const configurationRoute = suffix.match(/^\/configurations\/([^/]+)$/);
      if (configurationRoute && req.method === "GET") {
        requirePermission(principal, "site:read");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTIONS.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        return await json(res, 200, { section, ...(await repository.getSiteConfiguration(site.id, section)) }, context);
      }

      if (configurationRoute && req.method === "PUT") {
        requirePermission(principal, "configuration:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Configuration writes are locked until commissioning.");
        const section = decodeURIComponent(configurationRoute[1]);
        if (!CONFIGURATION_SECTIONS.has(section)) throw new ApiError(404, "configuration_section_not_found", "The configuration section does not exist.");
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = body.configuration && typeof body.configuration === "object" ? body.configuration : body;
        const updated = await repository.saveSiteConfiguration(site.id, section, configuration, expectedRevision(req), principal.subject);
        await repository.audit({ principal, siteId, action: "site.configuration.updated", resourceType: "site_configuration", resourceId: section, result: "success", requestId, details: { revision: updated.revision } });
        res.setHeader("ETag", String(updated.revision));
        return await json(res, 200, { section, ...updated }, context);
      }

      if (req.method === "GET" && suffix === "/strategy") {
        requirePermission(principal, "strategy:read");
        const active = await repository.getActiveStrategy(site.id);
        return await json(res, 200, { strategy: canonicalStrategyVersion(active, site.id) }, context);
      }

      if (req.method === "POST" && suffix === "/strategy/drafts") {
        requirePermission(principal, "strategy:draft");
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = validateStrategyConfiguration(body.configuration);
        const baseRevision = Number(body.baseRevision ?? 0);
        if (!Number.isInteger(baseRevision) || baseRevision < 0) throw new ApiError(400, "invalid_base_revision", "baseRevision must be a non-negative integer.");
        const draft = await repository.createCanonicalStrategyDraft(site.id, baseRevision, configuration, principal.subject);
        return await json(res, 201, canonicalStrategyDraft(draft, site.id), context);
      }

      const canonicalDraftRoute = suffix.match(/^\/strategy\/drafts\/([^/]+)(\/(?:validate|simulate|activate))?$/);
      if (canonicalDraftRoute && req.method === "PUT" && !canonicalDraftRoute[2]) {
        requirePermission(principal, "strategy:draft");
        const draftId = decodeURIComponent(canonicalDraftRoute[1]);
        const body = await readJson(req, config.maximumBodyBytes);
        const configuration = validateStrategyConfiguration(body.configuration);
        const draft = await repository.updateCanonicalStrategyDraft(site.id, draftId, configuration, expectedRevision(req));
        return await json(res, 200, canonicalStrategyDraft(draft, site.id), context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/validate") {
        requirePermission(principal, "strategy:draft");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        validateStrategyConfiguration(draft.configuration);
        const devices = await repository.listDevices(site.id);
        const errors = devices.some((device) => device.type === "battery") ? [] : [{ path: "/battery", code: "battery_missing", message: "A commissioned battery is required for this strategy." }];
        const warnings = devices.some((device) => device.type === "meter") ? [] : [{ path: "/grid", code: "pcc_meter_missing", message: "A PCC meter is required before commissioning." }];
        const validation = { valid: errors.length === 0, errors, warnings };
        await repository.setCanonicalDraftValidation(site.id, draft.id, validation);
        return await json(res, 200, validation, context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/simulate") {
        requirePermission(principal, "strategy:simulate");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        if (!draft.validation?.valid) throw new ApiError(409, "strategy_validation_required", "Validate the current draft before simulation.");
        const body = await readJson(req, config.maximumBodyBytes);
        const from = Date.parse(body.horizonFrom); const to = Date.parse(body.horizonTo);
        if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 7 * 86400000) throw new ApiError(400, "invalid_simulation_horizon", "Simulation horizon must be valid and no longer than 168 hours.");
        const simulation = await repository.queueStrategySimulation(site.id, draft.id, draft.revision, body, principal.subject);
        return await json(res, 202, { simulationId: simulation.id, draftId: draft.id, status: simulation.status, horizonFrom: simulation.horizon_from, horizonTo: simulation.horizon_to, inputVersions: simulation.input_versions || {}, violations: simulation.violations || [] }, context);
      }

      if (canonicalDraftRoute && req.method === "POST" && canonicalDraftRoute[2] === "/activate") {
        requirePermission(principal, "strategy:activate");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Strategy activation is locked until commissioning.");
        if (!req.headers["idempotency-key"]) throw new ApiError(428, "idempotency_key_required", "Idempotency-Key is required for activation.");
        if (!site.openremoteStrategyAssetId) throw new ApiError(409, "strategy_asset_missing", "The site Strategy Asset is not configured.");
        const draft = await repository.getCanonicalStrategyDraft(site.id, decodeURIComponent(canonicalDraftRoute[1]));
        const body = await readJson(req, config.maximumBodyBytes);
        if (body.expectedDraftRevision !== draft.revision) throw new ApiError(412, "stale_revision", "The strategy draft changed before activation.");
        const requested = await repository.requestCanonicalActivation(site.id, draft, body.simulationId, principal.subject);
        try {
          await openRemote.writeManagedAttribute(site.openremoteStrategyAssetId, "strategyDocument", { revision: requested.revision, configuration: requested.configuration });
        } catch (error) { await repository.rejectCanonicalActivation(site.id, requested.revision); throw error; }
        await repository.audit({ principal, siteId, action: "strategy.activation.requested", resourceType: "strategy", resourceId: requested.id, result: "accepted", requestId, details: { revision: requested.revision } });
        return await json(res, 202, { siteId: site.id, code: requested.configuration.code, lifecycle: "activating", desiredRevision: requested.revision, rejectionReasons: [], safety: { limitsValid: false, controlReady: false, writesEnabled: config.writesEnabled, edgeOnline: false } }, context);
      }

      if (req.method === "GET" && suffix === "/strategy/versions") {
        requirePermission(principal, "strategy:read");
        const versions = await repository.listStrategyVersions(site.id);
        return await json(res, 200, { items: versions.map((item) => canonicalStrategyVersion(item, site.id)) }, context);
      }

      if (req.method === "GET" && suffix === "/strategy/status") {
        requirePermission(principal, "strategy:read");
        const versions = await repository.listStrategyVersions(site.id);
        const desired = versions[0] || null;
        const asset = site.openremoteStrategyAssetId ? await openRemote.getManagedAsset(site.openremoteStrategyAssetId) : null;
        const attributeValue = (name) => asset?.attributes?.[name]?.value ?? null;
        return await json(res, 200, { siteId: site.id, code: desired?.configuration?.code || attributeValue("strategyCode"), lifecycle: attributeValue("strategyLifecycle") || desired?.lifecycle || "draft", desiredRevision: desired?.revision || 0, appliedRevision: attributeValue("strategyAppliedRevision"), rejectionReasons: attributeValue("strategyLastError") ? [attributeValue("strategyLastError")] : [], safety: { limitsValid: attributeValue("limitsValid") === true, controlReady: attributeValue("controlReady") === true, writesEnabled: config.writesEnabled, edgeOnline: attributeValue("edgeOnline") === true } }, context);
      }

      if (req.method === "GET" && ["/devices", "/assets"].includes(suffix)) {
        requirePermission(principal, "asset:read");
        return await json(res, 200, { items: await loadDeviceRecords(site, repository, openRemote) }, context);
      }

      if (req.method === "POST" && ["/devices", "/assets"].includes(suffix)) {
        requirePermission(principal, "asset:manage");
        if(site.openremoteRealm!==config.realm)throw new ApiError(409,'use_verified_gateway_provisioning','Customer devices must be provisioned through OpenRemote-backed gateway selection.');
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Asset provisioning is locked until commissioning.");
        const input = validateDeviceInput(await readJson(req, config.maximumBodyBytes));
        const device = await repository.createDevice(site.id, input);
        try {
          const asset = await openRemote.createAsset(buildOpenRemoteAsset(device, site));
          const configured = await repository.bindOpenRemoteAsset(device.id, asset.id);
          await repository.audit({ principal, siteId, action: "device.provisioned", resourceType: "device", resourceId: device.id, result: "success", requestId, details: { type: device.type } });
          return await json(res, 201, publicDeviceConfiguration(configured), context);
        } catch (error) {
          await repository.markDeviceProvisioningFailed(device.id);
          await repository.audit({ principal, siteId, action: "device.provisioned", resourceType: "device", resourceId: device.id, result: "failed", requestId, details: { type: device.type } });
          throw error;
        }
      }

      const deviceRoute = suffix.match(/^\/(?:devices|assets)\/([^/]+)$/);
      if (deviceRoute && req.method === "GET") {
        requirePermission(principal, "asset:read");
        const device = await repository.getDevice(site.id, decodeURIComponent(deviceRoute[1]));
        if (!device.openremoteAssetId) return await json(res, 200, { ...publicDeviceConfiguration(device), live: null }, context);
        const asset = await openRemote.getManagedAsset(device.openremoteAssetId);
        return await json(res, 200, { ...publicDeviceConfiguration(device), live: normalizeDevice(device, asset) }, context);
      }

      if (deviceRoute && req.method === "PATCH") {
        requirePermission(principal, "asset:manage");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Asset management is locked until commissioning.");
        const deviceId = decodeURIComponent(deviceRoute[1]);
        const current = await repository.getDevice(site.id, deviceId);
        const patch = await readJson(req, config.maximumBodyBytes);
        const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => ["name", "manufacturer", "model", "serialNumber", "driverKey", "protocol", "connection"].includes(key)));
        const validated = validateDeviceInput({ ...current, ...allowed });
        const updated = await repository.updateDevice(site.id, deviceId, Object.fromEntries(Object.entries(validated).filter(([key]) => Object.hasOwn(allowed, key))), expectedRevision(req));
        if (updated.openremoteAssetId) {
          const existing = await openRemote.getManagedAsset(updated.openremoteAssetId);
          const identity = { manufacturer: updated.manufacturer, model: updated.model, serialNumber: updated.serialNumber, driverKey: updated.driverKey, protocol: updated.protocol };
          const attributes = { ...existing.attributes };
          for (const [name, value] of Object.entries(identity)) if (attributes[name]) attributes[name] = { ...attributes[name], value };
          await openRemote.updateAsset(updated.openremoteAssetId, { ...existing, name: updated.name, attributes });
        }
        await repository.audit({ principal, siteId, action: "device.updated", resourceType: "device", resourceId: deviceId, result: "success", requestId, details: { previousRevision: current.revision, revision: updated.revision } });
        res.setHeader("ETag", String(updated.revision));
        return await json(res, 200, publicDeviceConfiguration(updated), context);
      }

      if (req.method === "GET" && suffix === "/snapshot") {
        requirePermission(principal, "asset:read");
        return await json(res, 200, await loadSnapshot(site, repository, openRemote), context);
      }

      if (req.method === "GET" && suffix === "/events") {
        requirePermission(principal, "asset:read");
        cors(res, config, origin);
        res.setHeader("X-Request-Id", requestId);
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive" });
        let closed = false;
        req.on("close", () => { closed = true; });
        let previous = "";
        while (!closed) {
          try {
            await context.checkAccess();
            const snapshot = await loadSnapshot(site, repository, openRemote);
            await context.checkAccess();
            const serialized = JSON.stringify(snapshot);
            if (serialized !== previous) { res.write(`event: snapshot\ndata: ${serialized}\n\n`); previous = serialized; }
            else res.write(": keepalive\n\n");
          } catch (error) {
            if (['organisation_suspended','reauthentication_required'].includes(error.code)) {
              res.write(`event: access-denied\ndata: ${JSON.stringify({error:error.code})}\n\n`);
              res.end(); return;
            }
            res.write(`event: upstream-error\ndata: ${JSON.stringify({ error: error.code || "openremote_error", requestId })}\n\n`);
          }
          await new Promise((resolve) => setTimeout(resolve, config.snapshotRefreshMs));
        }
        return;
      }

      if (req.method === "POST" && suffix === "/commands/power") {
        requirePermission(principal, "command:write");
        if (!config.writesEnabled) throw new ApiError(423, "writes_locked", "Control writes are locked until commissioning.");
        if (!site.openremoteControlAssetId) throw new ApiError(409, "control_asset_missing", "The site Control Asset is not configured.");
        const command = await readJson(req, config.maximumBodyBytes);
        if (!Number.isInteger(command.sequence) || !Number.isFinite(command.requestedPowerKw) || typeof command.enable !== "boolean") {
          throw new ApiError(400, "invalid_command", "sequence, requestedPowerKw and enable are required.");
        }
        const payload = { ...command, requestedAt: new Date().toISOString(), requestedBy: principal.subject, ttlSeconds: command.ttlSeconds || 15 };
        await openRemote.writeManagedAttribute(site.openremoteControlAssetId, "powerCommand", payload);
        await repository.audit({ principal, siteId, action: "control.power.requested", resourceType: "control", resourceId: site.openremoteControlAssetId, result: "accepted", requestId, details: { sequence: command.sequence } });
        return await json(res, 202, { accepted: true, sequence: command.sequence, commandId: requestId }, context);
      }

      throw new ApiError(404, "not_found", "The requested API route does not exist.");
    } catch (error) {
      const response = toErrorResponse(error, requestId);
      return await json(res, response.status, response.body, context);
    }
  };
}
