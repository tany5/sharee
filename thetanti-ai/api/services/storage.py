import shutil
from pathlib import Path

from fastapi import UploadFile

from api.config import Settings
from api.utils.files import safe_child


class StorageProvider:
    async def save_upload(self, job_id: str, upload: UploadFile) -> Path:
        raise NotImplementedError

    async def write_output(self, job_id: str, filename: str, data: bytes) -> Path:
        raise NotImplementedError

    def public_url(self, job_id: str, filename: str) -> str:
        return f"/api/v1/files/{job_id}/{filename}"

    def resolve_output(self, job_id: str, filename: str) -> Path:
        raise NotImplementedError


class LocalStorageProvider(StorageProvider):
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def save_upload(self, job_id: str, upload: UploadFile) -> Path:
        suffix = Path(upload.filename or "image.png").suffix.lower() or ".png"
        target_dir = safe_child(self.settings.input_dir, job_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target = safe_child(target_dir, f"input{suffix}")
        with target.open("wb") as out:
            shutil.copyfileobj(upload.file, out)
        return target

    async def write_output(self, job_id: str, filename: str, data: bytes) -> Path:
        target_dir = safe_child(self.settings.output_dir, job_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target = safe_child(target_dir, filename)
        target.write_bytes(data)
        return target

    def resolve_output(self, job_id: str, filename: str) -> Path:
        path = safe_child(self.settings.output_dir, job_id, filename)
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(filename)
        return path
