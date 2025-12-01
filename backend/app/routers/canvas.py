from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any
from ..database import get_db
from ..models import Canvas

router = APIRouter(prefix="/canvas", tags=["canvas"])


class CanvasCreate(BaseModel):
    """Request body for creating a canvas."""
    pass


class CanvasUpdate(BaseModel):
    """Request body for updating a canvas."""
    nodes: list[dict[str, Any]] | None = None
    edges: list[dict[str, Any]] | None = None
    viewport: dict[str, float] | None = None


class CanvasResponse(BaseModel):
    """Response body for canvas operations."""
    id: str
    nodes: list[dict[str, Any]]
    edges: list[dict[str, Any]]
    viewport: dict[str, float]
    createdAt: str
    updatedAt: str

    class Config:
        from_attributes = True


@router.post("", response_model=dict)
async def create_canvas(db: Session = Depends(get_db)):
    """Create a new empty canvas."""
    canvas = Canvas()
    db.add(canvas)
    db.commit()
    db.refresh(canvas)
    return {"id": canvas.id}


@router.get("/{canvas_id}", response_model=CanvasResponse)
async def get_canvas(canvas_id: str, db: Session = Depends(get_db)):
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
async def update_canvas(
    canvas_id: str,
    update: CanvasUpdate,
    db: Session = Depends(get_db)
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
async def delete_canvas(canvas_id: str, db: Session = Depends(get_db)):
    """Delete a canvas."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    
    db.delete(canvas)
    db.commit()
    return {"success": True}

