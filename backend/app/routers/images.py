from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import uuid
import os
from ..database import get_db
from ..models import Image
from ..config import get_settings

router = APIRouter(prefix="/images", tags=["images"])
settings = get_settings()

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), db: Session = Depends(get_db)):
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

    image_id = str(uuid.uuid4())
    ext = (
        file.filename.split(".")[-1]
        if file.filename and "." in file.filename
        else "png"
    )
    filename = f"{image_id}.{ext}"
    filepath = os.path.join(settings.images_dir, filename)

    os.makedirs(settings.images_dir, exist_ok=True)

    with open(filepath, "wb") as f:
        f.write(content)

    image_record = Image(
        id=image_id,
        filename=filename,
        original_filename=file.filename,
        content_type=file.content_type,
        source="upload",
    )
    db.add(image_record)
    db.commit()

    return {
        "imageId": image_id,
        "imageUrl": f"/api/images/{image_id}",
    }


@router.get("/{image_id}")
async def get_image(image_id: str, db: Session = Depends(get_db)):
    """Retrieve an image by ID."""
    image_record = db.query(Image).filter(Image.id == image_id).first()
    if not image_record:
        raise HTTPException(status_code=404, detail="Image not found")

    filepath = os.path.join(settings.images_dir, image_record.filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(
        filepath,
        media_type=image_record.content_type or "image/png",
        filename=image_record.original_filename or image_record.filename,
    )


@router.delete("/{image_id}")
async def delete_image(image_id: str, db: Session = Depends(get_db)):
    """Delete an image."""
    image_record = db.query(Image).filter(Image.id == image_id).first()
    if not image_record:
        raise HTTPException(status_code=404, detail="Image not found")

    filepath = os.path.join(settings.images_dir, image_record.filename)
    if os.path.exists(filepath):
        os.remove(filepath)

    db.delete(image_record)
    db.commit()

    return {"success": True}
