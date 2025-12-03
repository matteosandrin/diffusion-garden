from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import base64
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


class DescribeRequest(BaseModel):
    """Request for image description."""
    image_base64: str


class DescribeResponse(BaseModel):
    """Response from image description."""
    description: str


class GenerateRequest(BaseModel):
    """Request for image generation."""
    prompt: str


class GenerateResponse(BaseModel):
    """Response from image generation."""
    imageId: str
    imageUrl: str


@router.post("/expand", response_model=ExpandResponse)
async def expand_text(request: ExpandRequest, ai_service: AIService = Depends(get_ai_service)):
    """
    Expand a text idea into a more detailed version.
    Uses OpenAI GPT-4o or GPT-4o-mini.
    """
    try:
        result = await ai_service.expand_text(request.text, request.model)
        return ExpandResponse(result=result)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to expand text: {str(e)}")


@router.post("/describe", response_model=DescribeResponse)
async def describe_image(request: DescribeRequest, ai_service: AIService = Depends(get_ai_service)):
    """
    Generate a detailed description of an image.
    Uses OpenAI GPT-4o Vision.
    """
    try:
        description = await ai_service.describe_image(request.image_base64)
        return DescribeResponse(description=description)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to describe image: {str(e)}")


@router.post("/generate", response_model=GenerateResponse)
async def generate_image(
    request: GenerateRequest,
    ai_service: AIService = Depends(get_ai_service),
    db: Session = Depends(get_db)
):
    """
    Generate an image from a text prompt.
    Uses Gemini for image generation.
    """
    try:
        # Generate image
        image_bytes = await ai_service.generate_image(request.prompt)
        
        # Save image to filesystem
        image_id = str(uuid.uuid4())
        filename = f"{image_id}.png"
        filepath = os.path.join(settings.images_dir, filename)
        
        # Ensure images directory exists
        os.makedirs(settings.images_dir, exist_ok=True)
        
        with open(filepath, "wb") as f:
            f.write(image_bytes)
        
        # Save image record to database
        image_record = Image(
            id=image_id,
            filename=filename,
            content_type="image/png",
            source="generated",
            prompt=request.prompt,
        )
        db.add(image_record)
        db.commit()
        
        return GenerateResponse(
            imageId=image_id,
            imageUrl=f"/api/images/{image_id}",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate image: {str(e)}")

