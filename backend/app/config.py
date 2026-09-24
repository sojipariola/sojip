from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Core
    environment: str = "development"
    secret_key: str = "dev-secret-key-change-in-production"
    api_base_url: str = "http://localhost:8020"

    # Database
    database_url: str = "postgresql+asyncpg://sojip_user:sojip_pass@postgres:5432/sojip_db"
    redis_url: str = "redis://redis:6379/0"

    # Auth
    jwt_algorithm: str = "HS256"
    jwt_expiry_hours: int = 24

    # AI Serving
    ai_backend: str = "ollama"
    ollama_url: str = "http://ollama:11434/v1"
    ollama_model: str = "qwen3:8b"
    vllm_url: str = "http://vllm:8000/v1"
    vllm_model: str = "Qwen/Qwen3-8B-Instruct"
    ai_context_length: int = 8192
    ai_max_tokens: int = 1024
    ai_temperature: float = 0.7

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
    ]

    # GitHub OAuth
    github_client_id: str = ""
    github_client_secret: str = ""
    github_oauth_callback: str = (
        "http://localhost:8020/api/v1/auth/github/callback"
    )
    github_org: str = "sojip-projects"

    # Frontend URL for post-OAuth redirects
    frontend_url: str = "http://localhost:3001"

    # Token encryption
    token_encryption_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
