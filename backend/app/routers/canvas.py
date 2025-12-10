from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any
from ..utils import bucket
from ..database import get_db
from ..models import Canvas, Image
from ..config import get_settings
from ..rate_limiter import limiter

router = APIRouter(prefix="/canvas", tags=["canvas"])


class CanvasCreate(BaseModel):
    pass


class CanvasUpdate(BaseModel):
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    viewport: dict[str, float] | None = None


class CanvasResponse(BaseModel):
    id: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    viewport: dict[str, float]
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


class CanvasSummary(BaseModel):
    id: str
    thumbnailUrl: str | None
    nodeCount: int
    createdAt: str
    updatedAt: str


def extract_image_ids(nodes: list[dict[str, Any]] | None) -> list[str]:
    if not nodes:
        return []

    image_ids = []
    for node in nodes:
        data = node.get("data", {})
        if data.get("type") == "image":
            image_id = data.get("imageId")
            if image_id:
                image_ids.append(image_id)

    return image_ids


def extract_thumbnail_url(nodes: list[dict[str, Any]] | None) -> str | None:
    """Extract the first generated image URL, or if not found, any image URL from canvas nodes."""
    if not nodes:
        return None

    # First look for a generated image
    for node in nodes:
        data = node.get("data", {})
        if data.get("type") == "image" and data.get("source") == "generated":
            image_url = data.get("imageUrl")
            if image_url:
                return image_url

    # If not found, look for any image
    for node in nodes:
        data = node.get("data", {})
        if data.get("type") == "image":
            image_url = data.get("imageUrl")
            if image_url:
                return image_url

    return None


@router.get("", response_model=list[CanvasSummary])
@limiter.limit("60/minute")
async def list_canvases(request: Request, db: Session = Depends(get_db)):
    """List all canvases with thumbnails."""
    canvases = db.query(Canvas).order_by(Canvas.updated_at.desc()).all()

    return [
        CanvasSummary(
            id=canvas.id,
            thumbnailUrl=extract_thumbnail_url(canvas.nodes),
            nodeCount=len(canvas.nodes) if canvas.nodes else 0,
            createdAt=canvas.created_at.isoformat() if canvas.created_at else "",
            updatedAt=canvas.updated_at.isoformat() if canvas.updated_at else "",
        )
        for canvas in canvases
    ]


@router.post("", response_model=dict)
@limiter.limit("30/minute")
async def create_canvas(request: Request, db: Session = Depends(get_db)):
    """Create a new empty canvas."""
    canvas = Canvas()
    db.add(canvas)
    db.commit()
    db.refresh(canvas)
    return {"id": canvas.id}


@router.get("/{canvas_id}", response_model=CanvasResponse)
@limiter.limit("120/minute")
async def get_canvas(request: Request, canvas_id: str, db: Session = Depends(get_db)):
    """Load a canvas by ID."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    return CanvasResponse(
        id=canvas.id,
        nodes=canvas.nodes or [],
        edges=canvas.edges or [],
        viewport=canvas.viewport or {"x": 0, "y": 0, "zoom": 1},
        createdAt=canvas.created_at.isoformat() if canvas.created_at else "",
        updatedAt=canvas.updated_at.isoformat() if canvas.updated_at else "",
    )


@router.put("/{canvas_id}")
@limiter.limit("120/minute")
async def update_canvas(
    request: Request,
    canvas_id: str,
    update: CanvasUpdate,
    db: Session = Depends(get_db),
):
    """Update a canvas (nodes, edges, viewport)."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    if update.nodes is not None:
        canvas.nodes = update.nodes
    if update.edges is not None:
        canvas.edges = update.edges
    if update.viewport is not None:
        canvas.viewport = update.viewport

    db.commit()
    return {"success": True}


@router.delete("/{canvas_id}")
@limiter.limit("20/minute")
async def delete_canvas(
    request: Request, canvas_id: str, db: Session = Depends(get_db)
):
    """Delete a canvas and all associated images."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    image_ids = extract_image_ids(canvas.nodes)
    settings = get_settings()

    for image_id in image_ids:
        image_record = db.query(Image).filter(Image.id == image_id).first()
        if image_record:
            bucket.delete_image(image_record.filename, db)

    db.delete(canvas)
    db.commit()
    return {"success": True}
