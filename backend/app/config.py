import os
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

_THIS_DIR = Path(__file__).resolve().parent
_ENV_FILE = _THIS_DIR.parent / ".env"


class Settings(BaseSettings):
    database_url: str  # required
    r2_url: str  # required
    r2_public_url: str  # required
    r2_bucket: str  # required
    r2_access_key: str  # required
    r2_secret_key: str  # required
    openai_api_key: str = ""
    google_api_key: str = ""
    ipdata_api_key: str = ""
    pushover_token: str = ""
    pushover_user: str = ""
    debug: bool = True

    class Config:
        env_file = _ENV_FILE
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
