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
  return {
    port: integer(env.PORT, 8080),
    openRemoteBaseUrl,
    realm,
    openRemoteRequestTimeoutMs: integer(env.OPENREMOTE_REQUEST_TIMEOUT_MS, 5000),
    openRemoteServiceClientId: env.OPENREMOTE_SERVICE_CLIENT_ID || "gridex-api",
    openRemoteServiceClientSecret: env.OPENREMOTE_SERVICE_CLIENT_SECRET || "",
    oidcIssuer,
    oidcJwksUri: env.OIDC_JWKS_URI || `${oidcIssuer}/protocol/openid-connect/certs`,
    oidcAudience,
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
    configurationWorkerPollMs: integer(env.GRIDEX_CONFIG_WORKER_POLL_MS, 2000),
    configurationWorkerLeaseSeconds: integer(env.GRIDEX_CONFIG_WORKER_LEASE_SECONDS, 60),
    configurationWorkerMaximumAttempts: integer(env.GRIDEX_CONFIG_WORKER_MAX_ATTEMPTS, 8),
  };
}

export function validateProductionConfig(config) {
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
