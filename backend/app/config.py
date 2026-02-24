"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment or .env file."""

    database_url: str = "sqlite+aiosqlite:///data/bonus_tracker.db"
    cors_origins: list[str] = ["http://localhost:5173"]
    default_bonus_rate: float = 0.02

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
