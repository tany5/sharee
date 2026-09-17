import base64
import csv
import re
from pathlib import Path

import httpx

from api.config import Settings
from api.schemas.jobs import JobRecord, JobResult, JobType
from api.services.storage import LocalStorageProvider


_PLACEHOLDER_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lWccVwAAAABJRU5ErkJggg=="
)


class ImageModel:
    name = "base"

    async def generate(self, job: JobRecord) -> JobResult:
        raise NotImplementedError


class FluxImageModel(ImageModel):
    name = "flux"

    def __init__(self, settings: Settings, storage: LocalStorageProvider) -> None:
        self.settings = settings
        self.storage = storage

    async def generate(self, job: JobRecord) -> JobResult:
        if job.type == JobType.image_to_image and job.metadata.get("input_image"):
            return await self._generate_tryon(job)
        if not self.settings.mock_generation:
            raise RuntimeError("Real text-to-image generation is not configured yet.")
        filename = "result.png"
        await self.storage.write_output(job.job_id, filename, _PLACEHOLDER_PNG)
        return JobResult(url=self.storage.public_url(job.job_id, filename), file_id=f"{job.job_id}/{filename}")

    async def _generate_tryon(self, job: JobRecord) -> JobResult:
        payload = {
            "slug": job.job_id,
            "pose": job.metadata.get("pose", "full_saree"),
            "name": job.metadata.get("name", "TheTanti saree"),
            "color": job.metadata.get("color", "cream with red green gold motifs"),
            "fabric": job.metadata.get("fabric", "silk"),
            "image_path": job.metadata["input_image"],
        }
        timeout = httpx.Timeout(connect=5, read=8 * 60, write=30, pool=5)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(self.settings.local_tryon_url, json=payload)
        response.raise_for_status()
        data = response.json()
        result = data.get("result") if isinstance(data, dict) else None
        if not data.get("ok") or not isinstance(result, dict) or not result.get("ok"):
            error = (result or data).get("error") if isinstance(result or data, dict) else "local try-on failed"
            raise RuntimeError(f"Local try-on engine failed: {error}")

        source = Path(result["file"])
        if not source.exists() or source.stat().st_size < 20_000:
            raise RuntimeError(f"Local try-on output missing or too small: {source}")

        filename = "result.png"
        await self.storage.write_output(job.job_id, filename, source.read_bytes())
        job.metadata["local_tryon_result"] = result
        return JobResult(url=self.storage.public_url(job.job_id, filename), file_id=f"{job.job_id}/{filename}")


class QwenImageModel(FluxImageModel):
    name = "qwen_image"

    async def generate(self, job: JobRecord) -> JobResult:
        if job.type == JobType.image_to_image and job.metadata.get("input_image"):
            return await self._generate_qwen_tryon(job)
        raise RuntimeError("Qwen text-to-image is not configured for this backend yet.")

    async def _generate_qwen_tryon(self, job: JobRecord) -> JobResult:
        api_key = self._qwen_api_key()
        model_ref = self.settings.qwen_model_ref_path.resolve()
        garment_ref = Path(job.metadata["input_image"]).resolve()
        if not model_ref.exists():
            raise RuntimeError(f"Qwen model reference missing: {model_ref}")
        if not garment_ref.exists():
            raise RuntimeError(f"Qwen garment reference missing: {garment_ref}")

        content = [
            {"image": self._file_data_url(model_ref)},
            {"image": self._file_data_url(garment_ref)},
            {"text": self._qwen_prompt(job)},
        ]
        task = await self._submit_qwen_task(api_key, content, job)
        image_url = await self._wait_qwen_result(api_key, task)
        timeout = httpx.Timeout(connect=10, read=60, write=30, pool=5)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            image = await client.get(image_url)
        image.raise_for_status()
        data = image.content
        if len(data) < 20_000:
            raise RuntimeError("Qwen returned an unexpectedly small image.")
        filename = "result.png"
        await self.storage.write_output(job.job_id, filename, data)
        job.metadata["qwen_result"] = {
            "provider": f"qwen:{self.settings.qwen_image_model}",
            "model_ref": str(model_ref),
            "garment_ref": str(garment_ref),
        }
        return JobResult(url=self.storage.public_url(job.job_id, filename), file_id=f"{job.job_id}/{filename}")

    def _qwen_api_key(self) -> str:
        direct = (self.settings.qwen_api_key or self.settings.dashscope_api_key or "").strip()
        if direct:
            return direct
        candidates: list[Path] = []
        if self.settings.qwen_api_key_file:
            candidates.append(self.settings.qwen_api_key_file)
        secret_dir = self.settings.qwen_secret_dir.resolve()
        if secret_dir.exists():
            candidates.extend(secret_dir.glob("*apiKey*.csv"))
        for candidate in candidates:
            if not candidate.exists():
                continue
            found = self._extract_key(candidate.read_text(encoding="utf-8", errors="ignore"))
            if found:
                return found
        raise RuntimeError("Qwen API key missing. Set QWEN_API_KEY, DASHSCOPE_API_KEY, or QWEN_API_KEY_FILE.")

    @staticmethod
    def _extract_key(text: str) -> str | None:
        match = re.search(r"\b(sk-[A-Za-z0-9][A-Za-z0-9_-]{12,})\b", text)
        if match:
            return match.group(1)
        for row in csv.reader(text.splitlines()):
            for cell in row:
                value = cell.strip().strip('"')
                if re.fullmatch(r"[A-Za-z0-9_-]{24,}", value):
                    return value
        return None

    @staticmethod
    def _file_data_url(path: Path) -> str:
        content_type = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }.get(path.suffix.lower(), "image/png")
        return f"data:{content_type};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"

    def _qwen_prompt(self, job: JobRecord) -> str:
        return "\n".join(
            [
                "Use image 1 as the exact adult Bengali/Indian model reference.",
                "Use image 2 as the exact saree product reference.",
                "Drape the exact saree from image 2 onto the model from image 1.",
                "Preserve the saree base colour, red/green/gold motifs, border width, motif placement, pallu identity, fabric sheen, and weave texture.",
                "Do not convert it into a plain gold saree. Do not invent a new border or remove the printed motifs.",
                "Create a realistic full-body ecommerce catalogue photo, front-facing, head to feet visible, natural hands, subtle bindi, light jewellery, clean studio background.",
                f"User instruction: {job.prompt}",
                f"Negative instruction: {job.negative_prompt}",
            ]
        )

    async def _submit_qwen_task(self, api_key: str, content: list[dict[str, str]], job: JobRecord) -> str:
        body = {
            "model": self.settings.qwen_image_model,
            "input": {"messages": [{"role": "user", "content": content}]},
            "parameters": {
                "watermark": False,
                "negative_prompt": job.negative_prompt
                or "low quality, distorted face, wrong saree colour, missing motifs, plain gold saree, cropped feet, text, watermark",
            },
        }
        url = f"{self.settings.qwen_api_endpoint.rstrip('/')}/services/aigc/multimodal-generation/generation"
        timeout = httpx.Timeout(connect=10, read=60, write=30, pool=5)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                    "X-DashScope-Async": "enable",
                },
                json=body,
            )
        data = response.json()
        if not response.is_success:
            raise RuntimeError(f"Qwen submit failed ({response.status_code}): {self._qwen_error(data)}")
        task_id = data.get("output", {}).get("task_id")
        if not task_id:
            raise RuntimeError(f"Qwen submit returned no task id: {self._qwen_error(data)}")
        return task_id

    async def _wait_qwen_result(self, api_key: str, task_id: str) -> str:
        status_url = f"{self.settings.qwen_api_endpoint.rstrip('/')}/tasks/{task_id}"
        timeout = httpx.Timeout(connect=10, read=30, write=30, pool=5)
        async with httpx.AsyncClient(timeout=timeout) as client:
            for _ in range(80):
                response = await client.get(status_url, headers={"Authorization": f"Bearer {api_key}"})
                data = response.json()
                if not response.is_success:
                    raise RuntimeError(f"Qwen status failed ({response.status_code}): {self._qwen_error(data)}")
                status = data.get("output", {}).get("task_status")
                if status == "SUCCEEDED":
                    url = self._qwen_result_url(data)
                    if not url:
                        raise RuntimeError("Qwen completed but returned no image URL.")
                    return url
                if status in {"FAILED", "CANCELED", "UNKNOWN"}:
                    raise RuntimeError(f"Qwen task {status.lower()}: {self._qwen_error(data)}")
                await self._sleep(3)
        raise RuntimeError("Qwen task timed out.")

    @staticmethod
    async def _sleep(seconds: float) -> None:
        import asyncio

        await asyncio.sleep(seconds)

    @staticmethod
    def _qwen_result_url(data: dict) -> str | None:
        output = data.get("output", {})
        for item in output.get("results", []) or []:
            if item.get("url") or item.get("image_url"):
                return item.get("url") or item.get("image_url")
        for choice in output.get("choices", []) or []:
            message = choice.get("message", {})
            for item in message.get("content", []) or []:
                if item.get("image") or item.get("url") or item.get("image_url"):
                    return item.get("image") or item.get("url") or item.get("image_url")
        return output.get("url")

    @staticmethod
    def _qwen_error(data: dict) -> str:
        return ": ".join(
            str(part)
            for part in [data.get("code"), data.get("message"), data.get("output", {}).get("message")]
            if part
        ) or "unknown error"
