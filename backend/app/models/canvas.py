from sqlalchemy import Column, String, Text, DateTime, JSON, Integer
from sqlalchemy.sql import func
from ..database import Base
import uuid


class Canvas(Base):
    __tablename__ = "canvases"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nodes = Column(JSON, default=list)
    edges = Column(JSON, default=list)
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
    source = Column(String(50))
    prompt = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Job(Base):
    __tablename__ = "jobs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    type = Column(String(20), nullable=False)  # "text" or "image"
    status = Column(
        String(20), nullable=False, default="pending"
    )  # pending, running, completed, failed, cancelled
    block_id = Column(String(50), nullable=False)  # Links to frontend block
    request_data = Column(JSON, nullable=False)  # prompt, model, inputs
    result_data = Column(JSON)  # Generated content
    error = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class AnalyticsLog(Base):
    __tablename__ = "analytics_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_type = Column(String(20), nullable=False)  # "text" or "image"
    model = Column(String(100), nullable=False)
    input_tokens = Column(Integer, default=0)
    output_tokens = Column(Integer, default=0)
    total_tokens = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
