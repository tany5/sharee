import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from api.config import get_settings
from api.routes import fashion, files, health, image, jobs, video
from api.services.job_manager import InMemoryJobQueue
from api.services.storage import LocalStorageProvider

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    storage = LocalStorageProvider(settings)
    queue = InMemoryJobQueue(settings, storage)
    app.state.settings = settings
    app.state.storage = storage
    app.state.jobs = queue
    queue.start()
    yield


app = FastAPI(
    title="TheTanti AI Generation API",
    description="Self-hosted image and vertical reel video generation layer for TheTanti.",
    version="0.1.0",
    lifespan=lifespan,
)

app.include_router(health.router, prefix="/api/v1")
app.include_router(image.router, prefix="/api/v1")
app.include_router(video.router, prefix="/api/v1")
app.include_router(fashion.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
