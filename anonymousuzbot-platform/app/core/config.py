from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="anonymous-chat", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    bot_token: str = Field(alias="BOT_TOKEN")
    bot_parse_mode: str = Field(default="HTML", alias="BOT_PARSE_MODE")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    admin_session_secret: str = Field(default="change-me-in-production", alias="ADMIN_SESSION_SECRET")
    admin_bootstrap_username: str | None = Field(default=None, alias="ADMIN_BOOTSTRAP_USERNAME")
    admin_bootstrap_password: str | None = Field(default=None, alias="ADMIN_BOOTSTRAP_PASSWORD")
    admin_bootstrap_role: str = Field(default="owner", alias="ADMIN_BOOTSTRAP_ROLE")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
