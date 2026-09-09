import { createRemoteJWKSet, jwtVerify } from "jose";
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
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    preferredUsername: typeof claims.preferred_username === "string" ? claims.preferred_username : undefined,
    roles,
    permissions,
    accessToken,
  };
}

export function createAuthenticator(config, options = {}) {
  const jwks = options.jwks || createRemoteJWKSet(new URL(config.oidcJwksUri));
  const verify = options.jwtVerify || jwtVerify;
  return async function authenticate(req) {
    const accessToken = bearerToken(req);
    try {
      const { payload } = await verify(accessToken, jwks, {
        issuer: config.oidcIssuer,
        audience: config.oidcAudience,
        clockTolerance: config.oidcClockToleranceSeconds,
      });
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
