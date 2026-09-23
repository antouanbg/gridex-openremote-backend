import { ApiError } from "./errors.mjs";

const integer = (value, fallback) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid positive integer: ${value}`);
  return parsed;
};

export function loadConfig(env = process.env) {
  const openRemoteBaseUrl = (env.OPENREMOTE_BASE_URL || "http://manager:8080").replace(/\/$/, "");
  const realm = env.OPENREMOTE_REALM || "gridex";
  const oidcIssuer = (env.OIDC_ISSUER || `${openRemoteBaseUrl}/auth/realms/${realm}`).replace(/\/$/, "");
  const oidcAudience = env.OIDC_AUDIENCE || "gridex-portal";
  let historyBindings = [];
  if (env.GRIDEX_HISTORY_BINDINGS) {
    try {
      const parsed = JSON.parse(env.GRIDEX_HISTORY_BINDINGS);
      if (!Array.isArray(parsed)) throw new Error('must be an array');
      historyBindings = parsed;
    } catch (error) {
      throw new Error(`Invalid GRIDEX_HISTORY_BINDINGS: ${error.message}`);
    }
  }
  return {
    port: integer(env.PORT, 8080),
    heartbeatStaleMs: integer(env.GRIDEX_HEARTBEAT_STALE_SECONDS, 30) * 1000,
    heartbeatOfflineMs: integer(env.GRIDEX_HEARTBEAT_OFFLINE_SECONDS, 90) * 1000,
    deviceVaultDirectory: env.GRIDEX_DEVICE_VAULT_DIRECTORY || '',
    deviceVaultKeyFile: env.GRIDEX_DEVICE_VAULT_KEY_FILE || '',
    openRemoteBaseUrl,
    realm,
    openRemoteRequestTimeoutMs: integer(env.OPENREMOTE_REQUEST_TIMEOUT_MS, 5000),
    openRemoteServiceClientId: env.OPENREMOTE_SERVICE_CLIENT_ID || "gridex-api",
    openRemoteServiceClientSecret: env.OPENREMOTE_SERVICE_CLIENT_SECRET || "",
    oidcIssuer,
    oidcTokenEndpoint: env.OIDC_TOKEN_ENDPOINT || `${oidcIssuer}/protocol/openid-connect/token`,
    oidcJwksUri: env.OIDC_JWKS_URI || `${oidcIssuer}/protocol/openid-connect/certs`,
    oidcAudience,
    reauthOnApiRestart: env.GRIDEX_REAUTH_ON_API_RESTART === 'true',
    enrollmentEnabled: env.GRIDEX_ENROLLMENT_ENABLED === 'true',
    enrollmentClientSecret: env.GRIDEX_ENROLLMENT_CLIENT_SECRET || '',
    enrollmentAdminUrl: env.GRIDEX_ENROLLMENT_ADMIN_URL || '',
    enrollmentRedirectUri: env.GRIDEX_ENROLLMENT_REDIRECT_URI || '',
    oidcClockToleranceSeconds: integer(env.OIDC_CLOCK_TOLERANCE_SECONDS, 10),
    database: env.GRIDEX_DATABASE_URL ? { connectionString: env.GRIDEX_DATABASE_URL } : env.PGHOST ? {
      host: env.PGHOST,
      port: integer(env.PGPORT, 5432),
      database: env.PGDATABASE || "gridex",
      user: env.PGUSER || "gridex",
      password: env.PGPASSWORD || "",
    } : null,
    autoMigrate: env.GRIDEX_AUTO_MIGRATE === "true",
    allowMemoryDatabase: env.GRIDEX_ALLOW_MEMORY_DB === "true",
    writesEnabled: env.GRIDEX_WRITES_ENABLED === "true",
    allowedOrigins: new Set((env.GRIDEX_ALLOWED_ORIGINS || "")
      .split(",").map((value) => value.trim()).filter(Boolean)),
    snapshotRefreshMs: integer(env.GRIDEX_SNAPSHOT_REFRESH_MS, 5000),
    maximumBodyBytes: integer(env.GRIDEX_MAXIMUM_BODY_BYTES, 131072),
    historyBindings,
    historyMaximumRangeMs: integer(env.GRIDEX_HISTORY_MAXIMUM_RANGE_HOURS, 744) * 60 * 60 * 1000,
  };
}

export function validateProductionConfig(config) {
  if (config.heartbeatOfflineMs <= config.heartbeatStaleMs) throw new Error('Heartbeat offline threshold must exceed stale threshold');
  if (config.enrollmentEnabled && (!config.enrollmentClientSecret || !config.enrollmentAdminUrl
    || !config.allowedOrigins.has(new URL(config.enrollmentRedirectUri).origin))) {
    throw new Error('Enrollment requires a dedicated client secret, admin URL and allowed callback origin');
  }
  if (!config.database && !config.allowMemoryDatabase) {
    throw new Error("GrideX PostgreSQL settings are required unless GRIDEX_ALLOW_MEMORY_DB=true");
  }
  if (!config.oidcIssuer.startsWith("https://") && !config.oidcIssuer.startsWith("http://manager:")) {
    throw new Error("OIDC_ISSUER must use HTTPS outside the internal Docker network");
  }
  if (!config.openRemoteServiceClientSecret) {
    throw new Error("OPENREMOTE_SERVICE_CLIENT_SECRET is required for managed Asset reads and writes");
  }
}

export function assertAllowedOrigin(config, origin) {
  if (origin && !config.allowedOrigins.has(origin)) {
    throw new ApiError(403, "origin_not_allowed", "This web origin is not allowed.");
  }
}
