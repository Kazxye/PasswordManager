import json
import logging

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # --- PostgreSQL ---
    postgres_user: str = "vaultkeeper"
    postgres_password: str = "changeme"
    postgres_db: str = "vaultkeeper"
    postgres_host: str = "postgres"
    postgres_port: int = 5432

    # --- Redis ---
    redis_host: str = "redis"
    redis_port: int = 6379

    # --- JWT ---
    jwt_secret_key: str = "CHANGE_ME"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 15

    # --- Refresh Token ---
    refresh_token_expire_days: int = 7

    # --- FastAPI ---
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_env: str = "development"
    api_debug: bool = True

    # --- CORS ---
    cors_origins: str = '["https://localhost:3000","https://localhost"]'

    @property
    def database_url(self) -> str:
        """Connection string for async SQLAlchemy (asyncpg driver)."""
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parses JSON string from env into a Python list."""
        try:
            return json.loads(self.cors_origins)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Failed to parse CORS_ORIGINS, falling back to empty list")
            return []

    @property
    def is_development(self) -> bool:
        return self.api_env == "development"


settings = Settings()