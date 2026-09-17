from api.config import Settings
from api.schemas.jobs import JobRecord, JobResult
from api.services.storage import LocalStorageProvider


_PLACEHOLDER_MP4 = (
    b"\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2avc1mp41"
    + b"\x00\x00\x00\x08free"
    + b"\x00" * 8192
)


class VideoModel:
    name = "base"

    async def generate(self, job: JobRecord) -> JobResult:
        raise NotImplementedError


class WanVideoModel(VideoModel):
    name = "wan"

    def __init__(self, settings: Settings, storage: LocalStorageProvider) -> None:
        self.settings = settings
        self.storage = storage

    async def generate(self, job: JobRecord) -> JobResult:
        filename = "result.mp4"
        await self.storage.write_output(job.job_id, filename, _PLACEHOLDER_MP4)
        return JobResult(url=self.storage.public_url(job.job_id, filename), file_id=f"{job.job_id}/{filename}")


class LTXVideoModel(WanVideoModel):
    name = "ltx"
