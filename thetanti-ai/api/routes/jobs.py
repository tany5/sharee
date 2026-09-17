from fastapi import APIRouter, Depends, HTTPException, Request, status

from api.dependencies import require_api_key
from api.schemas.jobs import JobRecord

router = APIRouter(prefix="/jobs", tags=["jobs"], dependencies=[Depends(require_api_key)])


@router.get("/{job_id}", response_model=JobRecord)
async def get_job(job_id: str, request: Request) -> JobRecord:
    job = await request.app.state.jobs.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "JOB_NOT_FOUND", "message": "Generation job was not found."},
        )
    return job
