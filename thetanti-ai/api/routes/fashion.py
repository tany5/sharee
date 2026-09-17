from fastapi import APIRouter, Depends, Request

from api.dependencies import limit_video_jobs, require_api_key
from api.schemas.jobs import JobQueuedResponse, JobRecord, JobType
from api.schemas.video import FashionGenerationRequest
from api.services.job_manager import resolve_seed
from api.services.prompt_service import prompt_service
from api.utils.ids import new_job_id
from api.utils.validation import REEL_HEIGHT, REEL_WIDTH

router = APIRouter(prefix="/fashion", tags=["fashion"], dependencies=[Depends(require_api_key)])


@router.post("/generate", response_model=JobQueuedResponse, dependencies=[Depends(limit_video_jobs)])
async def fashion_generate(payload: FashionGenerationRequest, request: Request) -> JobQueuedResponse:
    seed = resolve_seed(payload.seed)
    model = payload.video_model if payload.generate_video else payload.image_model
    job = JobRecord(
        job_id=new_job_id("fashion"),
        type=JobType.fashion,
        model=model,
        prompt=prompt_service.prepare(payload.prompt, model),
        seed=seed,
        width=REEL_WIDTH if payload.generate_video else 1024,
        height=REEL_HEIGHT if payload.generate_video else 1024,
        duration=5 if payload.generate_video else None,
        fps=24 if payload.generate_video else None,
        metadata={"product_image": payload.product_image, "generate_video": payload.generate_video},
    )
    await request.app.state.jobs.enqueue(job)
    return JobQueuedResponse(job_id=job.job_id, seed=seed, width=job.width, height=job.height)
