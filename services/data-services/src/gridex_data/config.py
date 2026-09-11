from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Infrastructure/secrets only; site configuration lives in OpenRemote assets."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    entsoe_token: str = ""
    entsoe_security_token_file: str = "/run/secrets/entsoe_security_token"
    entsoe_base_url: str = "https://web-api.tp.entsoe.eu/api"
    open_meteo_base_url: str = "https://api.open-meteo.com"
    open_meteo_api_key: str = ""
    open_meteo_interval_min: int = 60
    data_db_dsn: str = ""
    or_url: str = ""
    or_realms: str = "master"
    or_client_id: str = "gridex-data-services"
    or_client_secret: str = ""
    discovery_interval_min: int = 5
    default_tz: str = "UTC"

    @property
    def realms(self) -> list[str]:
        return [realm.strip() for realm in self.or_realms.split(",") if realm.strip()]

    def resolved_entsoe_token(self) -> str:
        """Read the runtime secret file first; never log or serialize the value."""
        if self.entsoe_security_token_file:
            token_path = Path(self.entsoe_security_token_file)
            if token_path.is_file():
                token = token_path.read_text(encoding="utf-8").strip()
                if token:
                    return token
        return self.entsoe_token.strip()
