from ..utils import bucket
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, Request
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from ..database import get_db
from ..models import Image
from ..config import get_settings
from ..rate_limiter import limiter

router = APIRouter(prefix="/images", tags=["images"])
settings = get_settings()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
@limiter.limit("30/minute")
async def upload_image(
    request: Request, file: UploadFile = File(...), db: Session = Depends(get_db)
):
    """Upload an image file."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_TYPES)}",
        )
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE // (1024*1024)}MB",
        )
    image_id, image_url = await bucket.upload_image_and_record(
        content, file.content_type, db
    )
    return {"imageId": image_id, "imageUrl": image_url}


@router.delete("/{image_id}")
@limiter.limit("30/minute")
async def delete_image(
    request: Request, image_filename: str, db: Session = Depends(get_db)
):
    """Delete an image from r2 and database."""
    image_id = image_filename.split(".")[0]
    image_record = db.query(Image).filter(Image.id == image_id).first()
    if not image_record:
        raise HTTPException(status_code=404, detail="Image not found")
    try:
        bucket.delete_image(image_filename, db)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to delete image from r2: {str(e)}"
        )
    return {"success": True}
