import asyncio
import json
from pathlib import Path
from typing import Any

import httpx

from api.config import Settings


class ComfyUIClient:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                response = await client.get(f"{self.settings.comfyui_url}/system_stats")
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def submit_workflow(self, workflow_name: str, replacements: dict[str, Any]) -> str:
        workflow = self._load_workflow(workflow_name)
        for node_id, inputs in replacements.items():
            if node_id in workflow and isinstance(workflow[node_id].get("inputs"), dict):
                workflow[node_id]["inputs"].update(inputs)
        payload = {"prompt": workflow}
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(f"{self.settings.comfyui_url}/prompt", json=payload)
        response.raise_for_status()
        return str(response.json().get("prompt_id", ""))

    async def wait_for_completion(self, prompt_id: str) -> dict[str, Any]:
        deadline = asyncio.get_running_loop().time() + self.settings.comfyui_timeout_sec
        async with httpx.AsyncClient(timeout=10) as client:
            while asyncio.get_running_loop().time() < deadline:
                response = await client.get(f"{self.settings.comfyui_url}/history/{prompt_id}")
                if response.status_code == 200:
                    data = response.json()
                    if prompt_id in data:
                        return data[prompt_id]
                await asyncio.sleep(2)
        raise TimeoutError("ComfyUI generation timed out")

    @staticmethod
    def _load_workflow(workflow_name: str) -> dict[str, Any]:
        path = Path("comfyui/workflows") / workflow_name
        if not path.exists():
            raise FileNotFoundError(f"Missing ComfyUI workflow template: {path}")
        return json.loads(path.read_text(encoding="utf-8"))
