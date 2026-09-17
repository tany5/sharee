import asyncio
from pathlib import Path

import pytest
from asgi_lifespan import LifespanManager
from httpx import ASGITransport, AsyncClient

from api.main import app
from api.schemas.jobs import JobRecord, JobType
from api.services.image_generator import FluxImageModel


AUTH = {"Authorization": "Bearer change-me"}


@pytest.mark.asyncio
async def test_health():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["service"] == "thetanti-ai"


@pytest.mark.asyncio
async def test_auth_required_for_generation():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/images/generations", json={"prompt": "red saree"})
    assert res.status_code == 401


@pytest.mark.asyncio
async def test_image_job_lifecycle():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/v1/images/generations",
                headers=AUTH,
                json={"prompt": "A luxury Indian fashion model wearing a red saree"},
            )
            assert created.status_code == 200
            job_id = created.json()["job_id"]
            for _ in range(20):
                job = await client.get(f"/api/v1/jobs/{job_id}", headers=AUTH)
                if job.json()["status"] == "completed":
                    break
                await asyncio.sleep(0.05)
    assert job.json()["status"] == "completed"
    assert job.json()["result"]["url"].endswith("/result.png")
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            file_res = await client.get(job.json()["result"]["url"], headers=AUTH)
    assert file_res.status_code == 200
    assert file_res.headers["content-type"].startswith("image/png")


@pytest.mark.asyncio
async def test_video_forces_reel_resolution():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            created = await client.post(
                "/api/v1/videos/generations",
                headers=AUTH,
                json={
                    "prompt": "cinematic saree reel",
                    "width": 832,
                    "height": 480,
                    "duration": 5,
                },
            )
    assert created.status_code == 200
    assert created.json()["width"] == 1080
    assert created.json()["height"] == 1920


@pytest.mark.asyncio
async def test_invalid_prompt_rejected():
    async with LifespanManager(app):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/v1/videos/generations", headers=AUTH, json={"prompt": ""})
    assert res.status_code == 422


@pytest.mark.asyncio
async def test_image_to_image_uses_local_tryon(monkeypatch, tmp_path):
    source = tmp_path / "tryon.png"
    source.write_bytes(b"x" * 25_000)

    class FakeResponse:
        def raise_for_status(self):
            return None

        def json(self):
            return {"ok": True, "result": {"ok": True, "file": str(source), "engine": "test"}}

    class FakeClient:
        def __init__(self, *args, **kwargs):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, json):
            return FakeResponse()

    monkeypatch.setattr("api.services.image_generator.httpx.AsyncClient", FakeClient)
    async with LifespanManager(app):
        job = JobRecord(
            job_id="img_tryon_test",
            type=JobType.image_to_image,
            model="flux",
            prompt="drape saree",
            seed=1,
            metadata={"input_image": str(Path("input.png"))},
        )
        result = await FluxImageModel(app.state.settings, app.state.storage).generate(job)
    assert result.url.endswith("/api/v1/files/img_tryon_test/result.png")
    assert "local_tryon_result" in job.metadata


@pytest.mark.asyncio
async def test_qwen_image_to_image(monkeypatch, tmp_path):
    model_ref = tmp_path / "model.png"
    garment_ref = tmp_path / "garment.png"
    output = b"q" * 25_000
    model_ref.write_bytes(b"m" * 25_000)
    garment_ref.write_bytes(b"g" * 25_000)

    class FakeResponse:
        def __init__(self, payload=None, content=b"", ok=True, status_code=200):
            self._payload = payload or {}
            self.content = content
            self.is_success = ok
            self.status_code = status_code

        def json(self):
            return self._payload

        def raise_for_status(self):
            return None

    class FakeClient:
        def __init__(self, *args, **kwargs):
            return None

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def post(self, url, headers=None, json=None):
            return FakeResponse({"output": {"task_id": "task_1"}})

        async def get(self, url, headers=None):
            if "/tasks/" in url:
                return FakeResponse({"output": {"task_status": "SUCCEEDED", "results": [{"url": "https://example.test/out.png"}]}})
            return FakeResponse(content=output)

    monkeypatch.setattr("api.services.image_generator.httpx.AsyncClient", FakeClient)
    async with LifespanManager(app):
        app.state.settings.qwen_api_key = "sk-test-key"
        app.state.settings.qwen_model_ref_path = model_ref
        job = JobRecord(
            job_id="img_qwen_test",
            type=JobType.image_to_image,
            model="qwen_image",
            prompt="drape exact saree",
            seed=1,
            metadata={"input_image": str(garment_ref)},
        )
        result = await app.state.jobs.image_models["qwen_image"].generate(job)
    assert result.url.endswith("/api/v1/files/img_qwen_test/result.png")
    assert job.metadata["qwen_result"]["provider"] == "qwen:qwen-image-edit"
