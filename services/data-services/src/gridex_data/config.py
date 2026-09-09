from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Infrastructure/secrets only; site configuration lives in OpenRemote assets."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    entsoe_token: str = ""
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
