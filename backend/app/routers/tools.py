from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import os
from ..services import AIService, get_ai_service
from ..database import get_db
from ..models import Image
from ..config import get_settings
from ..rate_limiter import limiter
from .settings import TextModelId, ImageModelId, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL

router = APIRouter(prefix="/tools", tags=["tools"])
settings = get_settings()


class GenerateTextRequest(BaseModel):
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: TextModelId = DEFAULT_TEXT_MODEL


class GenerateTextResponse(BaseModel):
    result: str


class GenerateImageRequest(BaseModel):
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: ImageModelId = DEFAULT_IMAGE_MODEL
    is_variation: bool = False


class GenerateImageResponse(BaseModel):
    imageId: str
    imageUrl: str


@router.post("/generate-text", response_model=GenerateTextResponse)
@limiter.limit("20/minute")
async def generate_text(
    request: Request,
    body: GenerateTextRequest,
    ai_service: AIService = Depends(get_ai_service),
):
    """
    Run a prompt with input text and/or images integrated into it.
    The input is combined with the prompt on the backend.
    Uses OpenAI GPT models (supports vision models when images are provided).
    """
    try:
        result = await ai_service.generate_text(
            body.prompt, body.input, body.image_urls, body.model
        )
        return GenerateTextResponse(result=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to run prompt: {str(e)}"
        )


@router.post("/generate-image", response_model=GenerateImageResponse)
@limiter.limit("20/minute")
async def generate_image(
    request: Request,
    body: GenerateImageRequest,
    ai_service: AIService = Depends(get_ai_service),
    db: Session = Depends(get_db),
):
    """
    Generate an image from a text prompt with optional input images.
    Uses Gemini for image generation.
    """
    try:
        image, mime_type = await ai_service.generate_image(
            body.prompt,
            body.input,
            body.image_urls,
            body.model,
            body.is_variation,
        )

        mime_to_extension = {
            "image/png": ("png", "PNG"),
            "image/jpeg": ("jpg", "JPEG"),
            "image/jpg": ("jpg", "JPEG"),
            "image/gif": ("gif", "GIF"),
            "image/webp": ("webp", "WEBP"),
            "image/bmp": ("bmp", "BMP"),
            "image/tiff": ("tiff", "TIFF"),
        }

        extension, _ = mime_to_extension.get(mime_type, ("png", "PNG"))

        image_id = str(uuid.uuid4())
        filename = f"{image_id}.{extension}"
        filepath = os.path.join(settings.images_dir, filename)

        os.makedirs(settings.images_dir, exist_ok=True)
        image.save(filepath)

        image_record = Image(
            id=image_id,
            filename=filename,
            content_type=mime_type,
            source="generated",
            prompt=body.prompt,
        )
        db.add(image_record)
        db.commit()

        return GenerateImageResponse(
            imageId=image_id,
            imageUrl=f"/api/images/{image_id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate image: {str(e)}"
        )
