from typing import Dict, List
from fastapi import APIRouter
from pydantic import BaseModel
from ..config import get_settings
from ..services import prompts

router = APIRouter(prefix="/settings", tags=["settings"])
settings = get_settings()

# Available models configuration
AVAILABLE_TEXT_MODELS = [
    {"id": "gpt-5.1", "label": "GPT-5.1"},
    {"id": "gpt-4o", "label": "GPT-4o"},
    {"id": "gpt-4o-mini", "label": "GPT-4o Mini"},
]

AVAILABLE_IMAGE_MODELS = [
    {"id" : "gemini-3-pro-image-preview", "label": "Nano Banana Pro"},
    {"id" : "gemini-2.5-flash-image" , "label" : "Nano Banana"}
]

DEFAULT_TEXT_MODEL = AVAILABLE_TEXT_MODELS[0]["id"]
DEFAULT_IMAGE_MODEL = AVAILABLE_IMAGE_MODELS[0]["id"]


class ModelOption(BaseModel):
    """A single model option."""
    id: str
    label: str


class ModelsResponse(BaseModel):
    """Available models and defaults response."""
    textModels: List[ModelOption]
    imageModels: List[ModelOption]
    defaultTextModel: str
    defaultImageModel: str


class SettingsResponse(BaseModel):
    """Current settings response."""
    defaultTextModel: str
    defaultImageModel: str
    apiKeyStatus: dict[str, bool]


class ApiKeyStatus(BaseModel):
    """API key status response."""
    openai: bool
    google: bool


@router.get("", response_model=SettingsResponse)
async def get_app_settings():
    """Get current application settings."""
    return SettingsResponse(
        defaultTextModel=DEFAULT_TEXT_MODEL,
        defaultImageModel=DEFAULT_IMAGE_MODEL,
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


@router.get("/prompts", response_model=Dict[str, str])
async def get_prompts():
    """
    Get a list of available prompts.
    """
    return prompts


@router.get("/models", response_model=ModelsResponse)
async def get_models():
    """Get available models and defaults."""
    return ModelsResponse(
        textModels=[ModelOption(**m) for m in AVAILABLE_TEXT_MODELS],
        imageModels=[ModelOption(**m) for m in AVAILABLE_IMAGE_MODELS],
        defaultTextModel=DEFAULT_TEXT_MODEL,
        defaultImageModel=DEFAULT_IMAGE_MODEL,
    )