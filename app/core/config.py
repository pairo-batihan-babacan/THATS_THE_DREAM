import os  # Add this import at the top
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # App
    APP_NAME: str = "FileConvert"
    # Wrap your defaults in os.getenv so they check the System Env first
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production")

    # Redis - This is the critical one!
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./fileconvert.db")

    # AI & Other secrets
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    # ... apply the same os.getenv pattern to your other secrets ...

    # Pydantic v2 configuration (Optional but recommended)
    model_config = {
        "env_file": ".env",
        "case_sensitive": True,
        "extra": "ignore"
    }

settings = Settings()