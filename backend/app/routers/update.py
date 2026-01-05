from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..rate_limiter import limiter
from ..utils.image_url_updater import update_canvas_image_urls

router = APIRouter(prefix="/update", tags=["update"])


@router.get("")
@limiter.limit("10/minute")
async def update_image_urls(request: Request, db: Session = Depends(get_db)):
    """Update image URLs in all canvas records.

    Updates all imageUrl fields to:
    1. Include file extension from the image database record
    2. Change path from "/api/images" to "/images"
    """
    try:
        result = update_canvas_image_urls(db)
        return {
            "success": True,
            "message": f"Updated {result['total_updates']} image URL(s) across {result['updated_canvases']} canvas(es)",
            **result,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update image URLs: {str(e)}"
        )
