import { ApiError } from "./errors.mjs";

export class OpenRemoteClient {
  constructor(config, fetchImplementation = fetch) {
    this.config = config;
    this.fetch = fetchImplementation;
    this.serviceToken = null;
  }

  async health() {
    try {
      const response = await this.fetch(this.config.openRemoteBaseUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(this.config.openRemoteRequestTimeoutMs),
      });
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async request(path, { token, method = "GET", body, signal } = {}) {
    const headers = new Headers({ Accept: "application/json" });
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (body !== undefined) headers.set("Content-Type", "application/json");
    const timeout = AbortSignal.timeout(this.config.openRemoteRequestTimeoutMs);
    const response = await this.fetch(
      `${this.config.openRemoteBaseUrl}/api/${encodeURIComponent(this.config.realm)}${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: signal ? AbortSignal.any([signal, timeout]) : timeout },
    );
    if (!response.ok) {
      if (response.status === 401) throw new ApiError(401, "openremote_authentication_failed", "The OpenRemote session was rejected.");
      if (response.status === 403) throw new ApiError(403, "openremote_access_denied", "OpenRemote denied access to this asset.");
      if (response.status === 404) throw new ApiError(404, "openremote_asset_not_found", "The OpenRemote asset was not found.");
      throw new ApiError(502, "openremote_error", "OpenRemote could not complete the request.");
    }
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  getCurrentUserAssets(userToken) {
    return this.request("/asset/user/current", { token: userToken });
  }

  queryAssets(query, token) {
    return this.request("/asset/query", { token, method: "POST", body: query });
  }

  getAsset(assetId, userToken) {
    return this.request(`/asset/${encodeURIComponent(assetId)}`, { token: userToken });
  }

  async getAssets(assetIds, userToken) {
    return Promise.all(assetIds.map((assetId) => this.getAsset(assetId, userToken)));
  }

  async getManagedAsset(assetId) {
    return this.getAsset(assetId, await this.getServiceToken());
  }

  async getManagedAssets(assetIds) {
    if (assetIds.length === 0) return [];
    const token = await this.getServiceToken();
    return this.getAssets(assetIds, token);
  }

  async getServiceToken() {
    const now = Date.now();
    if (this.serviceToken && this.serviceToken.expiresAt > now + 30000) return this.serviceToken.value;
    if (!this.config.openRemoteServiceClientSecret) {
      throw new ApiError(503, "service_account_not_configured", "OpenRemote asset management is not configured.");
    }
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.config.openRemoteServiceClientId,
      client_secret: this.config.openRemoteServiceClientSecret,
    });
    const response = await this.fetch(`${this.config.oidcIssuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(this.config.openRemoteRequestTimeoutMs),
    });
    if (!response.ok) throw new ApiError(503, "service_account_unavailable", "OpenRemote asset management is unavailable.");
    const payload = await response.json();
    if (!payload.access_token) throw new ApiError(503, "service_account_unavailable", "OpenRemote returned no service token.");
    this.serviceToken = { value: payload.access_token, expiresAt: now + Number(payload.expires_in || 60) * 1000 };
    return this.serviceToken.value;
  }

  async createAsset(asset) {
    return this.request("/asset", { token: await this.getServiceToken(), method: "POST", body: asset });
  }

  async updateAsset(assetId, asset) {
    return this.request(`/asset/${encodeURIComponent(assetId)}`, { token: await this.getServiceToken(), method: "PUT", body: asset });
  }

  async writeAttribute(assetId, attributeName, value, userToken) {
    return this.request(`/asset/${encodeURIComponent(assetId)}/attribute/${encodeURIComponent(attributeName)}`, {
      token: userToken,
      method: "PUT",
      body: value,
    });
  }

  async writeManagedAttribute(assetId, attributeName, value) {
    return this.writeAttribute(assetId, attributeName, value, await this.getServiceToken());
  }
}
