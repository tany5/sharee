import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status

from api.config import Settings, get_settings


def settings_dep() -> Settings:
    return get_settings()


async def require_api_key(
    authorization: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(settings_dep),
) -> None:
    expected = f"Bearer {settings.api_key}"
    if authorization != expected:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "A valid API key is required."},
        )


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int) -> None:
        now = time.monotonic()
        bucket = self._hits[key]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"code": "RATE_LIMITED", "message": "Too many generation jobs. Try again shortly."},
            )
        bucket.append(now)


rate_limiter = RateLimiter()


async def limit_image_jobs(request: Request, settings: Settings = Depends(settings_dep)) -> None:
    rate_limiter.check(f"image:{request.client.host if request.client else 'local'}", settings.max_image_jobs_per_minute)


async def limit_video_jobs(request: Request, settings: Settings = Depends(settings_dep)) -> None:
    rate_limiter.check(f"video:{request.client.host if request.client else 'local'}", settings.max_video_jobs_per_minute)
