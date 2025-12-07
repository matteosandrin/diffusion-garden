import asyncio
import json
import uuid
import os
import time
from typing import Dict
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job, Image
from ..services import AIService, get_ai_service
from ..config import get_settings
from ..rate_limiter import limiter
from .settings import TextModelId, ImageModelId, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL

router = APIRouter(prefix="/jobs", tags=["jobs"])
settings = get_settings()

# Throttle interval for SSE events (in seconds)
SSE_THROTTLE_INTERVAL = 0.150  # 150ms

# In-memory storage for running tasks (for cancellation)
running_tasks: Dict[str, asyncio.Task] = {}
# Event to signal cancellation to streaming generators
cancellation_events: Dict[str, asyncio.Event] = {}


class CreateTextJobRequest(BaseModel):
    block_id: str
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: TextModelId = DEFAULT_TEXT_MODEL


class CreateImageJobRequest(BaseModel):
    block_id: str
    prompt: str
    input: str | None = None
    image_urls: list[str] | None = None
    model: ImageModelId = DEFAULT_IMAGE_MODEL
    is_variation: bool = False


class CreateJobResponse(BaseModel):
    jobId: str


class JobResponse(BaseModel):
    jobId: str
    blockId: str
    type: str
    status: str
    result: dict | None = None
    error: str | None = None


def format_sse(event: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/generate-text", response_model=CreateJobResponse)
@limiter.limit("20/minute")
async def create_text_job(
    request: Request,
    body: CreateTextJobRequest,
    db: Session = Depends(get_db),
):
    """Create a text generation job."""
    job_id = str(uuid.uuid4())

    job = Job(
        id=job_id,
        type="text",
        status="pending",
        block_id=body.block_id,
        request_data={
            "prompt": body.prompt,
            "input": body.input,
            "image_urls": body.image_urls,
            "model": body.model,
        },
    )
    db.add(job)
    db.commit()

    return CreateJobResponse(jobId=job_id)


@router.post("/generate-image", response_model=CreateJobResponse)
@limiter.limit("20/minute")
async def create_image_job(
    request: Request,
    body: CreateImageJobRequest,
    db: Session = Depends(get_db),
):
    """Create an image generation job."""
    job_id = str(uuid.uuid4())

    job = Job(
        id=job_id,
        type="image",
        status="pending",
        block_id=body.block_id,
        request_data={
            "prompt": body.prompt,
            "input": body.input,
            "image_urls": body.image_urls,
            "model": body.model,
            "is_variation": body.is_variation,
        },
    )
    db.add(job)
    db.commit()

    return CreateJobResponse(jobId=job_id)


@router.get("/{job_id}/stream")
async def stream_job(
    job_id: str,
    db: Session = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
):
    """Stream job results via Server-Sent Events."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    def make_streaming_response(generator):
        return StreamingResponse(
            generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    # If job is already completed, return the result immediately
    if job.status == "completed":

        async def completed_stream():
            yield format_sse("done", {"result": job.result_data})

        return make_streaming_response(completed_stream())

    if job.status == "failed":

        async def failed_stream():
            yield format_sse("error", {"error": job.error or "Job failed"})

        return make_streaming_response(failed_stream())

    if job.status == "cancelled":

        async def cancelled_stream():
            yield format_sse("cancelled", {})

        return make_streaming_response(cancelled_stream())

    # Create cancellation event for this job
    cancel_event = asyncio.Event()
    cancellation_events[job_id] = cancel_event

    if job.type == "text":
        return make_streaming_response(
            stream_text_generation(job_id, job, db, ai_service, cancel_event)
        )
    else:
        return make_streaming_response(
            stream_image_generation(job_id, job, db, ai_service, cancel_event)
        )


async def stream_text_generation(
    job_id: str,
    job: Job,
    db: Session,
    ai_service: AIService,
    cancel_event: asyncio.Event,
):
    """Stream text generation chunks."""
    try:
        # Update job status to running
        job.status = "running"
        db.commit()

        request_data = job.request_data
        full_text = ""
        last_emit_time = 0.0
        pending_emit = False

        async for chunk in ai_service.generate_text(
            prompt=request_data["prompt"],
            input_text=request_data.get("input"),
            image_urls=request_data.get("image_urls"),
            model=request_data.get("model", DEFAULT_TEXT_MODEL),
        ):
            # Check for cancellation
            if cancel_event.is_set():
                job.status = "cancelled"
                db.commit()
                yield format_sse("cancelled", {})
                return

            full_text += chunk
            current_time = time.monotonic()

            # Throttle: only emit if enough time has passed since last emit
            if current_time - last_emit_time >= SSE_THROTTLE_INTERVAL:
                yield format_sse("chunk", {"text": full_text})
                last_emit_time = current_time
                pending_emit = False
            else:
                pending_emit = True

        # Always emit final state if there's pending content
        if pending_emit:
            yield format_sse("chunk", {"text": full_text})

        # Update job with result
        job.status = "completed"
        job.result_data = {"text": full_text}
        db.commit()

        yield format_sse("done", {"result": {"text": full_text}})

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        yield format_sse("error", {"error": str(e)})

    finally:
        # Cleanup
        cancellation_events.pop(job_id, None)
        running_tasks.pop(job_id, None)


async def stream_image_generation(
    job_id: str,
    job: Job,
    db: Session,
    ai_service: AIService,
    cancel_event: asyncio.Event,
):
    """Stream image generation result."""
    try:
        # Update job status to running
        job.status = "running"
        db.commit()

        if cancel_event.is_set():
            job.status = "cancelled"
            db.commit()
            yield format_sse("cancelled", {})
            return

        request_data = job.request_data

        image, mime_type = await ai_service.generate_image(
            prompt=request_data["prompt"],
            input=request_data.get("input"),
            image_urls=request_data.get("image_urls"),
            model=request_data.get("model", DEFAULT_IMAGE_MODEL),
            is_variation=request_data.get("is_variation", False),
        )

        if cancel_event.is_set():
            job.status = "cancelled"
            db.commit()
            yield format_sse("cancelled", {})
            return

        mime_to_extension = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/jpg": "jpg",
            "image/gif": "gif",
            "image/webp": "webp",
            "image/bmp": "bmp",
            "image/tiff": "tiff",
        }
        extension = mime_to_extension.get(mime_type, "png")

        image_id = str(uuid.uuid4())
        filename = f"{image_id}.{extension}"
        filepath = os.path.join(settings.images_dir, filename)

        os.makedirs(settings.images_dir, exist_ok=True)
        image.save(filepath)

        image_record = Image(
            id=image_id,
            filename=filename,
            content_type=mime_type,
            source="generated",
            prompt=request_data["prompt"],
        )
        db.add(image_record)

        job.status = "completed"
        job.result_data = {
            "imageId": image_id,
            "imageUrl": f"/api/images/{image_id}",
        }
        db.commit()

        yield format_sse("done", {"result": job.result_data})

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        db.commit()
        yield format_sse("error", {"error": str(e)})

    finally:
        # Cleanup
        cancellation_events.pop(job_id, None)
        running_tasks.pop(job_id, None)


@router.post("/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Cancel a running job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ["pending", "running"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot cancel job with status: {job.status}",
        )

    if job_id in cancellation_events:
        cancellation_events[job_id].set()

    job.status = "cancelled"
    db.commit()

    return {"success": True}


@router.get("/block/{block_id}", response_model=list[JobResponse])
async def get_jobs_for_block(
    block_id: str,
    db: Session = Depends(get_db),
):
    """Get jobs for a specific block."""
    jobs = (
        db.query(Job)
        .filter(Job.block_id == block_id)
        .order_by(Job.created_at.desc())
        .limit(10)
        .all()
    )

    return [
        JobResponse(
            jobId=job.id,
            blockId=job.block_id,
            type=job.type,
            status=job.status,
            result=job.result_data,
            error=job.error,
        )
        for job in jobs
    ]


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Get a specific job by ID."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return JobResponse(
        jobId=job.id,
        blockId=job.block_id,
        type=job.type,
        status=job.status,
        result=job.result_data,
        error=job.error,
    )
