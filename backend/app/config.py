import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

_THIS_DIR = Path(__file__).resolve().parent
_ENV_FILE = _THIS_DIR.parent / ".env"


class Settings(BaseSettings):
    openai_api_key: str = ""
    google_api_key: str = ""
    ipdata_api_key: str = ""
    pushover_token: str = ""
    pushover_user: str = ""
    database_url: str  # Required - will raise if DATABASE_URL not set
    images_dir: str  # Required - will raise if IMAGES_DIR not set
    debug: bool = True

    class Config:
        env_file = _ENV_FILE
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
