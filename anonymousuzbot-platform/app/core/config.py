import os
from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = Field(default="anonymous-chat", alias="APP_NAME")
    app_env: str = Field(default="development", alias="APP_ENV")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    bot_token: str = Field(alias="BOT_TOKEN")
    bot_parse_mode: str = Field(default="HTML", alias="BOT_PARSE_MODE")
    bot_username: str | None = Field(default=None, alias="BOT_USERNAME")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    webhook_url: str | None = Field(default=None, alias="WEBHOOK_URL")
    webhook_secret: str | None = Field(default=None, alias="WEBHOOK_SECRET")

    admin_session_secret: str = Field(default="change-me-in-production", alias="ADMIN_SESSION_SECRET")
    admin_secret: str | None = Field(default=None, alias="ADMIN_SECRET")
    admin_bootstrap_username: str | None = Field(default=None, alias="ADMIN_BOOTSTRAP_USERNAME")
    admin_bootstrap_password: str | None = Field(default=None, alias="ADMIN_BOOTSTRAP_PASSWORD")
    admin_bootstrap_role: str = Field(default="owner", alias="ADMIN_BOOTSTRAP_ROLE")

    owner_telegram_id: int | None = Field(default=None, alias="OWNER_TELEGRAM_ID")
    run_mode: str = Field(default="all", alias="RUN_MODE")

    ton_wallet_address: str | None = Field(default=None, alias="TON_WALLET_ADDRESS")
    toncenter_api_key: str | None = Field(default=None, alias="TONCENTER_API_KEY")
    ton_payment_ttl_minutes: int = Field(default=60, alias="TON_PAYMENT_TTL_MINUTES")

    @field_validator("database_url")
    @classmethod
    def normalize_db_url(cls, value: str) -> str:
        return _normalize_database_url(value)

    @model_validator(mode="after")
    def apply_runtime_overrides(self) -> "Settings":
        port = os.getenv("PORT")
        if port:
            self.api_port = int(port)
        if self.admin_secret:
            self.admin_session_secret = self.admin_secret
        if self.app_env == "production" and self.admin_session_secret == "change-me-in-production":
            raise ValueError("ADMIN_SESSION_SECRET or ADMIN_SECRET must be set in production")
        return self

    @property
    def use_webhook(self) -> bool:
        return bool(self.webhook_url)

    @property
    def effective_webhook_path(self) -> str:
        base = (self.webhook_url or "").rstrip("/")
        return f"{base}/webhook/telegram"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
