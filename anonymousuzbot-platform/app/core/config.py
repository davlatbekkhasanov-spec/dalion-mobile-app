from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = Field(default="development", alias="APP_ENV")
    app_name: str = Field(default="AnonymousUzBot Platform", alias="APP_NAME")
    api_host: str = Field(default="0.0.0.0", alias="API_HOST")
    api_port: int = Field(default=8000, alias="API_PORT")

    bot_token: str = Field(alias="BOT_TOKEN")
    bot_username: str = Field(default="anonymous_uzbot", alias="BOT_USERNAME")

    database_url: str = Field(alias="DATABASE_URL")
    redis_url: str = Field(alias="REDIS_URL")

    admin_api_key: str = Field(alias="ADMIN_API_KEY")
    telegram_id_encryption_key: str = Field(alias="TELEGRAM_ID_ENCRYPTION_KEY")

    premium_referral_target: int = Field(default=3, alias="PREMIUM_REFERRAL_TARGET")
    premium_referral_days: int = Field(default=7, alias="PREMIUM_REFERRAL_DAYS")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
