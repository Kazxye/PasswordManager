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
    jwt_secret_key: str = "1cb8759d0d474b33c2acae1021554cbd4017ead8302847808b77649e7fbad2374b6717c2ab25b1fedaa19d7bd647fca2b73ffa8573b83a417243e9b049bd9cb3"
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
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/0"

    @property
    def cors_origins_list(self) -> list[str]:
        """Parses CORS origins from env. Accepts comma-separated or JSON array."""
        raw = self.cors_origins.strip()
        if not raw:
            return []

        # Try JSON first (backwards compat)
        if raw.startswith("["):
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return [o.strip() for o in parsed if o.strip()]
            except (json.JSONDecodeError, TypeError):
                pass

        # Fallback: comma-separated
        return [o.strip() for o in raw.split(",") if o.strip()]

    @property
    def is_development(self) -> bool:
        return self.api_env == "development"


settings = Settings()