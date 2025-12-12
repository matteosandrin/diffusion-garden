from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import uuid
import os
from ..services import AIService, get_ai_service
from ..database import get_db
from ..models import Image
from ..config import get_settings

router = APIRouter(prefix="/tools", tags=["tools"])
settings = get_settings()


class ExpandRequest(BaseModel):
    """Request for text expansion."""
    text: str
    model: str = "gpt-5.1"


class ExpandResponse(BaseModel):
    """Response from text expansion."""
    result: str


class GenerateTextRequest(BaseModel):
    """Request for prompt execution with optional input and images."""
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: str = "gpt-5.1"


class GenerateTextResponse(BaseModel):
    """Response from prompt execution."""
    result: str

class GenerateImageRequest(BaseModel):
    """Request for image generation."""
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: str = "gemini-2.0-flash-preview-image-generation"


class GenerateImageResponse(BaseModel):
    """Response from image generation."""
    imageId: str
    imageUrl: str


@router.post("/generate-text", response_model=GenerateTextResponse)
async def execute_prompt(request: GenerateTextRequest, ai_service: AIService = Depends(get_ai_service)):
    """
    Execute a prompt with input text and/or images integrated into it.
    The input is combined with the prompt on the backend.
    Uses OpenAI GPT models (supports vision models when images are provided).
    """
    try:
        result = await ai_service.execute_prompt(request.prompt, request.input, request.image_urls, request.model)
        return GenerateTextResponse(result=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to execute prompt: {str(e)}")


@router.post("/generate-image", response_model=GenerateImageResponse)
async def generate_image(
    request: GenerateImageRequest,
    ai_service: AIService = Depends(get_ai_service),
    db: Session = Depends(get_db)
):
    """
    Generate an image from a text prompt with optional input images.
    Uses Gemini for image generation.
    """
    try:
        # Generate image
        image, mime_type = await ai_service.generate_image(request.prompt, request.input, request.image_urls, request.model)
        
        # Map mime_type to file extension and format
        mime_to_extension = {
            "image/png": ("png", "PNG"),
            "image/jpeg": ("jpg", "JPEG"),
            "image/jpg": ("jpg", "JPEG"),
            "image/gif": ("gif", "GIF"),
            "image/webp": ("webp", "WEBP"),
            "image/bmp": ("bmp", "BMP"),
            "image/tiff": ("tiff", "TIFF"),
        }
        
        # Get extension and format, default to PNG if unknown
        extension, _ = mime_to_extension.get(mime_type, ("png", "PNG"))
        
        # Save image to filesystem
        image_id = str(uuid.uuid4())
        filename = f"{image_id}.{extension}"
        filepath = os.path.join(settings.images_dir, filename)
        
        # Ensure images directory exists
        os.makedirs(settings.images_dir, exist_ok=True)
        image.save(filepath)
        
        # Save image record to database
        image_record = Image(
            id=image_id,
            filename=filename,
            content_type=mime_type,
            source="generated",
            prompt=request.prompt,
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
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

