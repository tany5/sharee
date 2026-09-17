from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse

from api.dependencies import require_api_key

router = APIRouter(prefix="/files", tags=["files"], dependencies=[Depends(require_api_key)])

MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
}


@router.get("/{job_id}/{filename}")
async def get_file(job_id: str, filename: str, request: Request) -> FileResponse:
    try:
        path = request.app.state.storage.resolve_output(job_id, filename)
    except FileNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "FILE_NOT_FOUND", "message": "Generated file was not found."},
        ) from None
    return FileResponse(path, media_type=MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"))
