"""REST-only OpenRemote client; it never accesses OpenRemote PostgreSQL."""
from time import monotonic

import httpx


class OpenRemoteClient:
    def __init__(self, base_url: str, realm: str, client_id: str, client_secret: str) -> None:
        self.base_url, self.realm = base_url.rstrip("/"), realm
        self.client_id, self.client_secret = client_id, client_secret
        self._token = ""
        self._expires_at = 0.0

    async def _authorization(self) -> str:
        if monotonic() < self._expires_at:
            return f"Bearer {self._token}"
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                f"{self.base_url}/auth/realms/{self.realm}/protocol/openid-connect/token",
                data={"grant_type": "client_credentials", "client_id": self.client_id,
                      "client_secret": self.client_secret},
            )
            response.raise_for_status()
            data = response.json()
        self._token = str(data["access_token"])
        self._expires_at = monotonic() + max(0, int(data.get("expires_in", 60)) - 30)
        return f"Bearer {self._token}"

    async def query_assets(self, query: dict[str, object]) -> list[dict[str, object]]:
        return await self._request("POST", "/asset/query", json=query)

    async def write_predicted(self, asset_id: str, attribute: str, points: list[tuple[int, float]]) -> object:
        return await self._request("PUT", f"/asset/predicted/{asset_id}/{attribute}",
                                   json=[{"x": timestamp, "y": round(value, 6)} for timestamp, value in points])

    async def write_attribute(self, asset_id: str, attribute: str, value: object) -> object:
        return await self._request("PUT", f"/asset/{asset_id}/attribute/{attribute}", json=value)

    async def _request(self, method: str, path: str, **kwargs: object) -> object:
        headers = {"Authorization": await self._authorization(), "Accept": "application/json"}
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(method, f"{self.base_url}/api/{self.realm}{path}", headers=headers, **kwargs)
            if response.status_code == 401:
                self._expires_at = 0.0
            response.raise_for_status()
            return response.json() if response.content else None
