from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field


class JobStatus(StrEnum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class JobType(StrEnum):
    image = "image"
    image_to_image = "image_to_image"
    text_to_video = "text_to_video"
    image_to_video = "image_to_video"
    fashion = "fashion"


class JobResult(BaseModel):
    url: str
    file_id: str


class JobRecord(BaseModel):
    job_id: str
    type: JobType
    status: JobStatus = JobStatus.queued
    progress: int = Field(0, ge=0, le=100)
    model: str
    prompt: str
    negative_prompt: str = ""
    seed: int
    width: int | None = None
    height: int | None = None
    steps: int | None = None
    guidance: float | None = None
    duration: int | None = None
    fps: int | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    result: JobResult | None = None
    error: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class JobQueuedResponse(BaseModel):
    job_id: str
    status: Literal["queued"] = "queued"
    seed: int
    width: int | None = None
    height: int | None = None
