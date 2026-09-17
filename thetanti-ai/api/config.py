from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    service_name: str = "thetanti-ai"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_key: str = Field("change-me", alias="THE_TANTI_API_KEY")

    comfyui_host: str = "127.0.0.1"
    comfyui_port: int = 8188
    comfyui_timeout_sec: int = 900
    comfyui_enabled: bool = False
    mock_generation: bool = True
    local_tryon_url: str = "http://127.0.0.1:8787/model-images"
    qwen_api_endpoint: str = "https://dashscope-intl.aliyuncs.com/api/v1"
    qwen_image_model: str = "qwen-image-edit"
    qwen_api_key: Optional[str] = Field(None, alias="QWEN_API_KEY")
    dashscope_api_key: Optional[str] = Field(None, alias="DASHSCOPE_API_KEY")
    qwen_api_key_file: Optional[Path] = Field(None, alias="QWEN_API_KEY_FILE")
    qwen_secret_dir: Path = Path("../secret/secret")
    qwen_model_ref_path: Path = Path("../public/marketing/models/bengali-model-01.png")

    image_model: str = "flux"
    video_model: str = "wan"
    output_dir: Path = Path("./storage/outputs")
    input_dir: Path = Path("./storage/inputs")
    temp_dir: Path = Path("./storage/temp")

    max_image_jobs_per_minute: int = 5
    max_video_jobs_per_minute: int = 2
    max_queue_size: int = 10
    max_upload_mb: int = 20

    reel_width: int = 1080
    reel_height: int = 1920
    default_video_duration: int = 5
    default_video_fps: int = 24

    @property
    def comfyui_url(self) -> str:
        return f"http://{self.comfyui_host}:{self.comfyui_port}"


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    for directory in (settings.output_dir, settings.input_dir, settings.temp_dir):
        directory.mkdir(parents=True, exist_ok=True)
    return settings
