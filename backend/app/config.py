from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "sqlite:///./career_mentor.db"
    jwt_secret: str = "replace-with-a-long-random-secret-at-least-32-characters"
    demo_email: str = "demo@careermentor.local"
    demo_password: str = "demo123"
    upload_dir: str = "uploads"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    max_upload_mb: int = 5
    llm_primary: str = "gemini"
    llm_fallback_enabled: bool = True
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    openai_api_key: str | None = None
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o-mini"

    @property
    def upload_path(self) -> Path:
        return Path(self.upload_dir)


settings = Settings()
