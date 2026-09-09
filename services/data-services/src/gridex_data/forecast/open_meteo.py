from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx


@dataclass(frozen=True)
class ForecastRequest:
    latitude: float
    longitude: float
    horizon_days: int
    models: str = "best_match"
    altitude_m: float | None = None


class OpenMeteoClient:
    def __init__(self, base_url: str, api_key: str = "") -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    async def weather(self, request: ForecastRequest) -> dict[str, object]:
        params: dict[str, object] = {
            "latitude": request.latitude, "longitude": request.longitude, "timezone": "UTC",
            "forecast_days": request.horizon_days, "past_days": 1, "models": request.models,
            "hourly": "temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,snowfall,snow_depth,shortwave_radiation,direct_normal_irradiance,diffuse_radiation",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,shortwave_radiation_sum,sunshine_duration,weather_code",
        }
        if request.altitude_m is not None:
            params["elevation"] = request.altitude_m
        return await self._get(params)

    async def irradiance(self, request: ForecastRequest, tilt: float, azimuth: float) -> dict[str, object]:
        return await self._get({
            "latitude": request.latitude, "longitude": request.longitude, "timezone": "UTC",
            "forecast_days": request.horizon_days, "past_days": 1, "models": request.models,
            "tilt": tilt, "azimuth": azimuth,
            "hourly": "global_tilted_irradiance,temperature_2m,wind_speed_10m",
            "minutely_15": "global_tilted_irradiance,temperature_2m",
        })

    async def _get(self, params: dict[str, object]) -> dict[str, object]:
        if self.api_key:
            params["apikey"] = self.api_key
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(f"{self.base_url}/v1/forecast", params=params)
            response.raise_for_status()
            return response.json()


def interval_start(timestamp: str, minutes: int) -> datetime:
    """Open-Meteo radiation labels describe the preceding interval."""
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00")) - timedelta(minutes=minutes)
