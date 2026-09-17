import asyncio
import logging
from datetime import datetime
from random import randint

from fastapi import HTTPException, status

from api.config import Settings
from api.schemas.jobs import JobRecord, JobResult, JobStatus, JobType
from api.services.image_generator import FluxImageModel, QwenImageModel
from api.services.storage import LocalStorageProvider
from api.services.video_generator import LTXVideoModel, WanVideoModel

logger = logging.getLogger("thetanti-ai.jobs")


def resolve_seed(seed: int) -> int:
    return randint(1, 2_147_483_647) if seed == -1 else seed


class JobQueue:
    async def enqueue(self, job: JobRecord) -> JobRecord:
        raise NotImplementedError

    async def get(self, job_id: str) -> JobRecord | None:
        raise NotImplementedError


class InMemoryJobQueue(JobQueue):
    def __init__(self, settings: Settings, storage: LocalStorageProvider) -> None:
        self.settings = settings
        self.storage = storage
        self.jobs: dict[str, JobRecord] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue(maxsize=settings.max_queue_size)
        self.worker_task: asyncio.Task[None] | None = None
        self.image_models = {
            "flux": FluxImageModel(settings, storage),
            "qwen_image": QwenImageModel(settings, storage),
        }
        self.video_models = {
            "wan": WanVideoModel(settings, storage),
            "ltx": LTXVideoModel(settings, storage),
        }

    def start(self) -> None:
        if self.worker_task is None or self.worker_task.done():
            self.worker_task = asyncio.create_task(self._worker())

    async def enqueue(self, job: JobRecord) -> JobRecord:
        if self.queue.full():
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={"code": "QUEUE_FULL", "message": "Generation queue is full."},
            )
        self.jobs[job.job_id] = job
        await self.queue.put(job.job_id)
        return job

    async def get(self, job_id: str) -> JobRecord | None:
        return self.jobs.get(job_id)

    async def _worker(self) -> None:
        while True:
            job_id = await self.queue.get()
            job = self.jobs[job_id]
            try:
                job.status = JobStatus.processing
                job.started_at = datetime.utcnow()
                job.progress = 10
                result = await self._run(job)
                job.result = result
                job.progress = 100
                job.status = JobStatus.completed
                job.completed_at = datetime.utcnow()
                logger.info("job=%s model=%s status=completed", job.job_id, job.model)
            except Exception as exc:  # noqa: BLE001 - clients get sanitized error below.
                logger.exception("job=%s failed", job.job_id)
                job.status = JobStatus.failed
                job.error = "Generation failed."
                job.completed_at = datetime.utcnow()
                job.metadata["internal_error"] = str(exc)
            finally:
                self.queue.task_done()

    async def _run(self, job: JobRecord) -> JobResult:
        job.progress = 35
        if job.type in {JobType.image, JobType.image_to_image, JobType.fashion} and not job.metadata.get("generate_video"):
            model = self.image_models.get(job.model)
            if not model:
                raise ValueError(f"Image model not found: {job.model}")
            return await model.generate(job)
        model = self.video_models.get(job.model)
        if not model:
            raise ValueError(f"Video model not found: {job.model}")
        return await model.generate(job)
