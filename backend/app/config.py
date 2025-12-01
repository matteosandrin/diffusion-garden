from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # API Keys
    openai_api_key: str = ""
    google_api_key: str = ""
    
    # Database
    database_url: str = "sqlite:///./canvas.db"
    
    # Image storage
    images_dir: str = "./images"
    
    # Server
    debug: bool = True
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()

