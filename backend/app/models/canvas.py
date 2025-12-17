from sqlalchemy import Column, String, Text, DateTime, JSON
from sqlalchemy.sql import func
from ..database import Base
import uuid


class Canvas(Base):
    __tablename__ = "canvases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nodes = Column(JSON, default=list)  # Array of node objects
    edges = Column(JSON, default=list)  # Array of edge objects
    viewport = Column(JSON, default=lambda: {"x": 0, "y": 0, "zoom": 1})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Image(Base):
    __tablename__ = "images"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    content_type = Column(String(100))
    source = Column(String(50))  # 'upload' or 'generated'
    prompt = Column(Text)  # If generated, store the prompt
    created_at = Column(DateTime(timezone=True), server_default=func.now())
