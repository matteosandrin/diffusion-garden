from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..utils import migrate_canvas_images_to_r2

router = APIRouter(prefix="/update", tags=["update"])


@router.get("")
async def update(db: Session = Depends(get_db)):
    result = migrate_canvas_images_to_r2(db)
    return {
        "success": True,
        "message": f"Migrated {result['total_uploaded']} images to R2",
        **result,
    }
