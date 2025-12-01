from fastapi import APIRouter
from pydantic import BaseModel
from ..config import get_settings

router = APIRouter(prefix="/settings", tags=["settings"])
settings = get_settings()


class SettingsResponse(BaseModel):
    """Current settings response."""
    defaultTextModel: str = "gpt-4o"
    defaultImageModel: str = "gemini-pro"
    apiKeyStatus: dict[str, bool]


class ApiKeyStatus(BaseModel):
    """API key status response."""
    openai: bool
    google: bool


@router.get("", response_model=SettingsResponse)
async def get_app_settings():
    """Get current application settings."""
    return SettingsResponse(
        defaultTextModel="gpt-4o",
        defaultImageModel="gemini-pro",
        apiKeyStatus={
            "openai": bool(settings.openai_api_key),
            "google": bool(settings.google_api_key),
        }
    )


@router.get("/api-keys/status", response_model=ApiKeyStatus)
async def check_api_keys():
    """Check if API keys are configured."""
    return ApiKeyStatus(
        openai=bool(settings.openai_api_key),
        google=bool(settings.google_api_key),
    )

