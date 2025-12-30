import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Job
from ..services import get_job_processor
from ..config import get_settings
from ..rate_limiter import limiter
from .settings import TextModelId, ImageModelId, DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL

router = APIRouter(prefix="/jobs", tags=["jobs"])
settings = get_settings()


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
    job_processor = get_job_processor()
    job_processor.enqueue_job(job_id)
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
    job_processor = get_job_processor()
    job_processor.enqueue_job(job_id)
    return CreateJobResponse(jobId=job_id)


@router.get("/{job_id}/stream")
async def stream_job(
    job_id: str,
    db: Session = Depends(get_db),
):
    """Stream job results via Server-Sent Events"""
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

    # Job is pending or running - subscribe to updates from the job processor
    return make_streaming_response(subscribe_to_job_updates(job_id))


async def subscribe_to_job_updates(job_id: str):
    """Subscribe to job updates from the processor and yield SSE events."""
    job_processor = get_job_processor()
    subscriber_queue = job_processor.subscribe(job_id)

    try:
        while True:
            try:
                # Wait for events with a timeout to allow cleanup
                event = await asyncio.wait_for(subscriber_queue.get(), timeout=60.0)
                yield format_sse(event.event_type, event.data)
                # Stop streaming on terminal events
                if event.event_type in ["done", "error", "cancelled"]:
                    break
            except asyncio.TimeoutError:
                # Send keepalive comment to prevent connection timeout
                yield ": keepalive\n\n"
    finally:
        job_processor.unsubscribe(job_id, subscriber_queue)


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
    job_processor = get_job_processor()
    job_processor.request_cancellation(job_id)
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
