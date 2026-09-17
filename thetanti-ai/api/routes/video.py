from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from api.dependencies import limit_video_jobs, require_api_key
from api.schemas.jobs import JobQueuedResponse, JobRecord, JobType
from api.schemas.video import VideoGenerationRequest
from api.services.job_manager import resolve_seed
from api.services.prompt_service import prompt_service
from api.utils.ids import new_job_id
from api.utils.validation import REEL_HEIGHT, REEL_WIDTH

router = APIRouter(prefix="/videos", tags=["videos"], dependencies=[Depends(require_api_key)])


@router.post("/generations", response_model=JobQueuedResponse, dependencies=[Depends(limit_video_jobs)])
async def generate_video(payload: VideoGenerationRequest, request: Request) -> JobQueuedResponse:
    seed = resolve_seed(payload.seed)
    job = JobRecord(
        job_id=new_job_id("vid"),
        type=JobType.text_to_video,
        model=payload.model,
        prompt=prompt_service.prepare(payload.prompt, payload.model),
        negative_prompt=payload.negative_prompt,
        seed=seed,
        width=REEL_WIDTH,
        height=REEL_HEIGHT,
        duration=payload.duration,
        fps=payload.fps,
    )
    await request.app.state.jobs.enqueue(job)
    return JobQueuedResponse(job_id=job.job_id, seed=seed, width=REEL_WIDTH, height=REEL_HEIGHT)


@router.post("/from-image", response_model=JobQueuedResponse, dependencies=[Depends(limit_video_jobs)])
async def video_from_image(
    request: Request,
    image: UploadFile = File(...),
    prompt: str = Form(...),
    negative_prompt: str = Form(""),
    model: str = Form("wan"),
    duration: int = Form(5),
    fps: int = Form(24),
    width: int = Form(REEL_WIDTH),
    height: int = Form(REEL_HEIGHT),
    seed: int = Form(-1),
) -> JobQueuedResponse:
    resolved_seed = resolve_seed(seed)
    job = JobRecord(
        job_id=new_job_id("vid"),
        type=JobType.image_to_video,
        model=model,
        prompt=prompt_service.prepare(prompt, model),
        negative_prompt=negative_prompt,
        seed=resolved_seed,
        width=REEL_WIDTH,
        height=REEL_HEIGHT,
        duration=max(2, min(duration, 10)),
        fps=max(8, min(fps, 30)),
        metadata={"requested_width": width, "requested_height": height},
    )
    saved = await request.app.state.storage.save_upload(job.job_id, image)
    job.metadata["input_image"] = str(saved)
    await request.app.state.jobs.enqueue(job)
    return JobQueuedResponse(job_id=job.job_id, seed=resolved_seed, width=REEL_WIDTH, height=REEL_HEIGHT)
