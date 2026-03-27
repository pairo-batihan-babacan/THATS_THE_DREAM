from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # App
    APP_NAME: str = "FileConvert"
    DEBUG: bool = False
    SECRET_KEY: str = "change-this-in-production"

    # File handling
    UPLOAD_DIR: str = "/tmp/fileconvert/uploads"
    OUTPUT_DIR: str = "/tmp/fileconvert/outputs"
    MAX_FILE_SIZE_MB: int = 20
    MAX_FILE_SIZE_MB_PRO: int = 50
    FILE_TTL_MINUTES: int = 30

    # Rate limiting
    FREE_CONVERSIONS_PER_DAY: int = 3

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Database — defaults to SQLite so the service works on Render without an
    # external PostgreSQL. Set DATABASE_URL to a postgres:// URI to use Postgres.
    DATABASE_URL: str = "sqlite+aiosqlite:///./fileconvert.db"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRO_PRICE_ID: str = ""

    # AI
    GROQ_API_KEY: str = ""

    # Supabase
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""
    SUPABASE_UPLOADS_BUCKET: str = "uploads"
    SUPABASE_OUTPUTS_BUCKET: str = "outputs"

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "ignore"


settings = Settings()
