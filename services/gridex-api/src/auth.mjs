import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";
import { ApiError } from "./errors.mjs";

const ROLE_PERMISSIONS = Object.freeze({
  viewer: ["site:read", "asset:read", "strategy:read"],
  operator: ["site:read", "asset:read", "command:write", "strategy:read", "strategy:draft", "strategy:simulate"],
  energy_manager: ["site:read", "asset:read", "command:write", "configuration:manage", "strategy:read", "strategy:draft", "strategy:simulate", "strategy:activate"],
  integrator: ["site:read", "asset:read", "asset:manage", "hardware:manage"],
  administrator: ["site:read", "asset:read", "asset:manage", "hardware:manage", "command:write", "configuration:manage", "strategy:read", "strategy:draft", "strategy:simulate", "strategy:activate", "organisation:manage"],
  admin: ["site:read", "asset:read", "asset:manage", "hardware:manage", "command:write", "configuration:manage", "strategy:read", "strategy:draft", "strategy:simulate", "strategy:activate", "organisation:manage"],
});

export function bearerToken(req) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) throw new ApiError(401, "authentication_required", "Please sign in.");
  const token = value.slice(7).trim();
  if (!token) throw new ApiError(401, "authentication_required", "Please sign in.");
  return token;
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

// Identity-provider roles must never bypass current database membership.
export function withMembershipRoles(principal, roles, platformAdminSubjects = new Set(), platformRealm = 'gridex') {
  const trustedRoles = [...new Set(roles.filter((role) => Object.hasOwn(ROLE_PERMISSIONS, role) && role !== 'admin'))];
  const platformAdmin = principal.emailVerified && principal.realm === platformRealm
    && platformAdminSubjects.has(principal.subject);
  return { ...principal, roles: [...trustedRoles, ...(platformAdmin ? ['platform_administrator'] : [])],
    permissions: [...new Set([...trustedRoles.flatMap((role) => ROLE_PERMISSIONS[role]), ...(platformAdmin ? ['platform:manage'] : [])])] };
}

export function principalFromClaims(claims, accessToken, audience) {
  const realmRoles = stringArray(claims.realm_access?.roles);
  const clientRoles = stringArray(claims.resource_access?.[audience]?.roles);
  const roles = [...new Set([...realmRoles, ...clientRoles])];
  const permissions = [...new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] || []))];
  if (!claims.sub || typeof claims.sub !== "string") {
    throw new ApiError(401, "invalid_token", "The identity token has no subject.");
  }
  return {
    subject: claims.sub,
    realm: typeof claims.iss === 'string' ? claims.iss.split('/realms/')[1] : undefined,
    issuer: claims.iss,
    authTime: Number.isFinite(claims.auth_time) ? claims.auth_time : undefined,
    email: typeof claims.email === "string" ? claims.email : undefined,
    emailVerified: claims.email_verified === true,
    name: typeof claims.name === "string" ? claims.name : undefined,
    preferredUsername: typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
    roles,
    permissions,
    accessToken,
  };
}

export function createAuthenticator(config, options = {}) {
  const startedAt = Math.floor((options.startedAt ?? Date.now()) / 1000);
  const jwks = options.jwks || createRemoteJWKSet(new URL(config.oidcJwksUri));
  const verify = options.jwtVerify || jwtVerify;
  const realmJwks = new Map();
  return async function authenticate(req) {
    const accessToken = bearerToken(req);
    try {
      let issuer = config.oidcIssuer;
      let keys = jwks;
      if (options.isAllowedRealm) {
        // Decode only to select a pre-authorised key set. Trust no claim until
        // signature, issuer and audience verification below has succeeded.
        const untrustedIssuer = decodeJwt(accessToken).iss;
        const prefix = config.oidcIssuer.slice(0, config.oidcIssuer.lastIndexOf('/realms/') + 8);
        if (typeof untrustedIssuer !== 'string' || !untrustedIssuer.startsWith(prefix))
          throw new ApiError(401, 'invalid_token', 'Identity issuer is not trusted.');
        const realm = untrustedIssuer.slice(prefix.length);
        if (!/^[a-z][a-z0-9-]{2,30}$/.test(realm)
            || (realm !== config.realm && !await options.isAllowedRealm(realm)))
          throw new ApiError(401, 'invalid_token', 'Identity realm is not available.');
        issuer = `${prefix}${realm}`;
        if (realm !== config.realm) {
          if (!realmJwks.has(realm)) {
            const source = new URL(config.oidcJwksUri);
            source.pathname = source.pathname.replace(`/realms/${config.realm}/`, `/realms/${realm}/`);
            realmJwks.set(realm, createRemoteJWKSet(source));
          }
          keys = realmJwks.get(realm);
        }
      }
      const { payload } = await verify(accessToken, keys, {
        issuer,
        audience: config.oidcAudience,
        clockTolerance: config.oidcClockToleranceSeconds,
      });
      // Browser refresh tokens must not bypass the owner's restart re-login policy.
      // Dedicated service clients keep their existing machine-to-machine lifecycle.
      if (config.reauthOnApiRestart && payload.azp === config.oidcAudience
          && (!Number.isFinite(payload.auth_time) || payload.auth_time < startedAt)) {
        throw new ApiError(401, 'reauthentication_required', 'Please sign in again after the server restart.');
      }
      return principalFromClaims(payload, accessToken, config.oidcAudience);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(401, "invalid_token", "The session is invalid or has expired.");
    }
  };
}

export function requirePermission(principal, permission) {
  if (!principal.permissions.includes(permission)) {
    throw new ApiError(403, "permission_denied", "You do not have permission for this action.");
  }
}
