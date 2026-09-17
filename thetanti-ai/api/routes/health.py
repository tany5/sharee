from fastapi import APIRouter, Depends, Request

from api.config import Settings
from api.dependencies import settings_dep
from api.services.comfyui import ComfyUIClient

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request, settings: Settings = Depends(settings_dep)) -> dict[str, object]:
    comfy_ok = await ComfyUIClient(settings).health() if settings.comfyui_enabled else settings.mock_generation
    return {
        "status": "ok",
        "service": settings.service_name,
        "gpu": comfy_ok,
        "image_generation": comfy_ok,
        "video_generation": comfy_ok,
        "queue_size": request.app.state.jobs.queue.qsize(),
    }


@router.get("/health/models")
async def models(settings: Settings = Depends(settings_dep)) -> dict[str, object]:
    return {
        "image_models": {
            "flux": settings.image_model == "flux" or settings.mock_generation,
            "qwen_image": settings.image_model == "qwen_image",
        },
        "video_models": {
            "wan": settings.video_model == "wan" or settings.mock_generation,
            "ltx": settings.video_model == "ltx",
        },
        "default_video_resolution": {"width": settings.reel_width, "height": settings.reel_height},
    }
