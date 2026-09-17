from fastapi import APIRouter, Depends, File, Form, Request, UploadFile

from api.dependencies import limit_image_jobs, require_api_key
from api.schemas.image import ImageGenerationRequest
from api.schemas.jobs import JobQueuedResponse, JobRecord, JobType
from api.services.job_manager import resolve_seed
from api.services.prompt_service import prompt_service
from api.utils.ids import new_job_id

router = APIRouter(prefix="/images", tags=["images"], dependencies=[Depends(require_api_key)])


@router.post("/generations", response_model=JobQueuedResponse, dependencies=[Depends(limit_image_jobs)])
async def generate_image(payload: ImageGenerationRequest, request: Request) -> JobQueuedResponse:
    seed = resolve_seed(payload.seed)
    job = JobRecord(
        job_id=new_job_id("img"),
        type=JobType.image,
        model=payload.model,
        prompt=prompt_service.prepare(payload.prompt, payload.model),
        negative_prompt=payload.negative_prompt,
        seed=seed,
        width=payload.width,
        height=payload.height,
        steps=payload.steps,
        guidance=payload.guidance,
        metadata={"num_images": payload.num_images},
    )
    await request.app.state.jobs.enqueue(job)
    return JobQueuedResponse(job_id=job.job_id, seed=seed, width=job.width, height=job.height)


@router.post("/edit", response_model=JobQueuedResponse, dependencies=[Depends(limit_image_jobs)])
async def edit_image(
    request: Request,
    image: UploadFile = File(...),
    prompt: str = Form(...),
    negative_prompt: str = Form(""),
    model: str = Form("flux"),
    strength: float = Form(0.65),
    width: int = Form(1024),
    height: int = Form(1024),
    seed: int = Form(-1),
) -> JobQueuedResponse:
    resolved_seed = resolve_seed(seed)
    job = JobRecord(
        job_id=new_job_id("img"),
        type=JobType.image_to_image,
        model=model,
        prompt=prompt_service.prepare(prompt, model),
        negative_prompt=negative_prompt,
        seed=resolved_seed,
        width=width,
        height=height,
        metadata={"strength": strength},
    )
    saved = await request.app.state.storage.save_upload(job.job_id, image)
    job.metadata["input_image"] = str(saved)
    await request.app.state.jobs.enqueue(job)
    return JobQueuedResponse(job_id=job.job_id, seed=resolved_seed, width=width, height=height)
