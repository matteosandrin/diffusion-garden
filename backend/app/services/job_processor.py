import asyncio
import os
import time
import uuid
from typing import Dict, Set
from dataclasses import dataclass

from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Job, Image
from ..config import get_settings
from .ai_service import AIService, get_ai_service
from ..routers.settings import DEFAULT_TEXT_MODEL, DEFAULT_IMAGE_MODEL

settings = get_settings()

SSE_THROTTLE_INTERVAL = 0.150  # 150ms


@dataclass
class JobEvent:
    """Event to be broadcast to SSE subscribers."""

    event_type: str  # "chunk", "done", "error", "cancelled"
    data: dict


class JobProcessor:
    """
    Background job processor that manages an in-memory queue and pub/sub
    for broadcasting updates to SSE subscribers.
    """

    def __init__(self):
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._subscribers: Dict[str, Set[asyncio.Queue]] = {}

        self._cancellation_events: Dict[str, asyncio.Event] = {}
        self._processor_task: asyncio.Task | None = None

        self._running = False

        self._ai_service: AIService | None = None

    async def start(self):
        """Start the background job processor."""
        if self._running:
            return
        self._running = True
        self._ai_service = get_ai_service()
        self._processor_task = asyncio.create_task(self._process_jobs())
        print("Job processor started")

    async def stop(self):
        self._running = False
        for event in self._cancellation_events.values():
            event.set()
        if self._processor_task:
            self._processor_task.cancel()
            try:
                await self._processor_task
            except asyncio.CancelledError:
                pass
        print("Job processor stopped")

    def enqueue_job(self, job_id: str):
        self._queue.put_nowait(job_id)
        print(f"Job {job_id} enqueued")

    def subscribe(self, job_id: str) -> asyncio.Queue:
        """
        Subscribe to updates for a job.
        Returns an asyncio.Queue that will receive JobEvent objects.
        """
        if job_id not in self._subscribers:
            self._subscribers[job_id] = set()
        subscriber_queue: asyncio.Queue = asyncio.Queue()
        self._subscribers[job_id].add(subscriber_queue)
        return subscriber_queue

    def unsubscribe(self, job_id: str, subscriber_queue: asyncio.Queue):
        if job_id in self._subscribers:
            self._subscribers[job_id].discard(subscriber_queue)
            if not self._subscribers[job_id]:
                del self._subscribers[job_id]

    def _broadcast(self, job_id: str, event: JobEvent):
        if job_id not in self._subscribers:
            return
        for subscriber_queue in self._subscribers[job_id]:
            try:
                subscriber_queue.put_nowait(event)
            except asyncio.QueueFull:
                # Skip if subscriber queue is full
                pass

    def request_cancellation(self, job_id: str) -> bool:
        """Request cancellation of a running job. Returns True if job was running."""
        if job_id in self._cancellation_events:
            self._cancellation_events[job_id].set()
            return True
        return False

    async def _process_jobs(self):
        """Main processing loop that picks up jobs from the queue."""
        while self._running:
            try:
                # Wait for a job with timeout to allow graceful shutdown
                try:
                    job_id = await asyncio.wait_for(self._queue.get(), timeout=1.0)
                except asyncio.TimeoutError:
                    continue
                await self._process_single_job(job_id)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in job processor loop: {e}")
                await asyncio.sleep(1)  # Prevent tight loop on repeated errors

    async def _process_single_job(self, job_id: str):
        """Process a single job."""
        db: Session = SessionLocal()
        try:
            job = db.query(Job).filter(Job.id == job_id).first()
            if not job:
                print(f"Job {job_id} not found")
                return
            if job.status not in ["pending"]:
                print(f"Job {job_id} has status {job.status}, skipping")
                return
            cancel_event = asyncio.Event()
            self._cancellation_events[job_id] = cancel_event
            try:
                if job.type == "text":
                    await self._process_text_job(job, db, cancel_event)
                elif job.type == "image":
                    await self._process_image_job(job, db, cancel_event)
                else:
                    job.status = "failed"
                    job.error = f"Unknown job type: {job.type}"
                    db.commit()
                    self._broadcast(job_id, JobEvent("error", {"error": job.error}))
            finally:
                self._cancellation_events.pop(job_id, None)

        except Exception as e:
            print(f"Error processing job {job_id}: {e}")
        finally:
            db.close()

    async def _process_text_job(
        self,
        job: Job,
        db: Session,
        cancel_event: asyncio.Event,
    ):
        job_id = job.id
        try:
            # Update job status to running
            job.status = "running"
            db.commit()
            request_data = job.request_data
            full_text = ""
            last_emit_time = 0.0
            pending_emit = False
            async for chunk in self._ai_service.generate_text(
                prompt=request_data["prompt"],
                input_text=request_data.get("input"),
                image_urls=request_data.get("image_urls"),
                model=request_data.get("model", DEFAULT_TEXT_MODEL),
            ):
                if cancel_event.is_set():
                    job.status = "cancelled"
                    db.commit()
                    self._broadcast(job_id, JobEvent("cancelled", {}))
                    return
                full_text += chunk
                current_time = time.monotonic()

                # Only send SSE event if enough time has passed since last event
                if current_time - last_emit_time >= SSE_THROTTLE_INTERVAL:
                    self._broadcast(job_id, JobEvent("chunk", {"text": full_text}))
                    last_emit_time = current_time
                    pending_emit = False
                else:
                    pending_emit = True
            # Always emit final state if there's pending content
            if pending_emit:
                self._broadcast(job_id, JobEvent("chunk", {"text": full_text}))
            job.status = "completed"
            job.result_data = {"text": full_text}
            db.commit()
            self._broadcast(job_id, JobEvent("done", {"result": {"text": full_text}}))
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            db.commit()
            self._broadcast(job_id, JobEvent("error", {"error": str(e)}))

    async def _process_image_job(
        self,
        job: Job,
        db: Session,
        cancel_event: asyncio.Event,
    ):
        job_id = job.id
        try:
            job.status = "running"
            db.commit()
            if cancel_event.is_set():
                job.status = "cancelled"
                db.commit()
                self._broadcast(job_id, JobEvent("cancelled", {}))
                return
            request_data = job.request_data
            image, mime_type = await self._ai_service.generate_image(
                prompt=request_data["prompt"],
                input=request_data.get("input"),
                image_urls=request_data.get("image_urls"),
                model=request_data.get("model", DEFAULT_IMAGE_MODEL),
                is_variation=request_data.get("is_variation", False),
            )
            if cancel_event.is_set():
                job.status = "cancelled"
                db.commit()
                self._broadcast(job_id, JobEvent("cancelled", {}))
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
            self._broadcast(job_id, JobEvent("done", {"result": job.result_data}))
        except Exception as e:
            job.status = "failed"
            job.error = str(e)
            db.commit()
            self._broadcast(job_id, JobEvent("error", {"error": str(e)}))


# Singleton instance
_job_processor: JobProcessor | None = None


def get_job_processor() -> JobProcessor:
    """Get or create the job processor singleton."""
    global _job_processor
    if _job_processor is None:
        _job_processor = JobProcessor()
    return _job_processor

