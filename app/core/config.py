import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App
    APP_NAME: str = "FileConvert"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production")

    # File handling
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "/tmp/fileconvert/uploads")
    OUTPUT_DIR: str = os.getenv("OUTPUT_DIR", "/tmp/fileconvert/outputs")
    MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "20"))
    MAX_FILE_SIZE_MB_PRO: int = int(os.getenv("MAX_FILE_SIZE_MB_PRO", "50"))
    FILE_TTL_MINUTES: int = int(os.getenv("FILE_TTL_MINUTES", "30"))

    # Rate limiting
    FREE_CONVERSIONS_PER_DAY: int = int(os.getenv("FREE_CONVERSIONS_PER_DAY", "3"))

    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./fileconvert.db")

    # Google OAuth
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")

    # Stripe
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    STRIPE_PRO_PRICE_ID: str = os.getenv("STRIPE_PRO_PRICE_ID", "")

    # AI
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")

    # Supabase
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    SUPABASE_UPLOADS_BUCKET: str = os.getenv("SUPABASE_UPLOADS_BUCKET", "uploads")
    SUPABASE_OUTPUTS_BUCKET: str = os.getenv("SUPABASE_OUTPUTS_BUCKET", "outputs")

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "https://pdfworks.io",
        "https://www.pdfworks.io",
        "https://api.pdfworks.io",  # If you use an api subdomain
        "http://localhost:3000",
    ]

    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

# This creates the object that the rest of the app imports
settings = Settings()