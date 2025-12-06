from typing import Dict, List, Literal, get_args
from fastapi import APIRouter
from pydantic import BaseModel
from ..config import get_settings
from ..prompts import prompts

router = APIRouter(prefix="/settings", tags=["settings"])
settings = get_settings()

TextModelId = Literal["gpt-5.1", "gpt-4.1", "gpt-4.1-mini", "gpt-4o", "gpt-4o-mini"]
ImageModelId = Literal["gemini-3-pro-image-preview", "gemini-2.5-flash-image"]

TEXT_MODEL_LABELS = {
    "gpt-5.1": "GPT-5.1",
    "gpt-4.1": "GPT-4.1",
    "gpt-4.1-mini": "GPT-4.1 mini",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o mini",
}

IMAGE_MODEL_LABELS = {
    "gemini-3-pro-image-preview": "Nano Banana Pro",
    "gemini-2.5-flash-image": "Nano Banana",
}

AVAILABLE_TEXT_MODELS = [
    {"id": model_id, "label": TEXT_MODEL_LABELS[model_id]}
    for model_id in get_args(TextModelId)
]

AVAILABLE_IMAGE_MODELS = [
    {"id": model_id, "label": IMAGE_MODEL_LABELS[model_id]}
    for model_id in get_args(ImageModelId)
]

DEFAULT_TEXT_MODEL: TextModelId = "gpt-5.1"
DEFAULT_IMAGE_MODEL: ImageModelId = "gemini-2.5-flash-image"


class ModelOption(BaseModel):
    id: str
    label: str


class ModelsResponse(BaseModel):
    textModels: List[ModelOption]
    imageModels: List[ModelOption]
    defaultTextModel: str
    defaultImageModel: str


class SettingsResponse(BaseModel):
    defaultTextModel: str
    defaultImageModel: str
    apiKeyStatus: dict[str, bool]


class ApiKeyStatus(BaseModel):
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
        },
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
