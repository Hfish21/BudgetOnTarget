from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "sqlite:///./budgetontarget.db"
    cors_origins: list[str] = ["http://localhost:3000"]
    api_prefix: str = "/api/v1"
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", env_prefix="BOT_")


settings = Settings()
