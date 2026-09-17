from pydantic import BaseModel, Field, field_validator, model_validator

from api.utils.validation import REEL_HEIGHT, REEL_WIDTH


class VideoGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)
    negative_prompt: str = Field("", max_length=2000)
    model: str = "wan"
    duration: int = Field(5, ge=2, le=10)
    width: int = REEL_WIDTH
    height: int = REEL_HEIGHT
    fps: int = Field(24, ge=8, le=30)
    seed: int = Field(-1, ge=-1)

    @field_validator("prompt")
    @classmethod
    def prompt_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt is required")
        return stripped

    @model_validator(mode="after")
    def force_reel_resolution(self) -> "VideoGenerationRequest":
        self.width = REEL_WIDTH
        self.height = REEL_HEIGHT
        return self


class FashionGenerationRequest(BaseModel):
    product_image: str = Field(..., min_length=1)
    prompt: str = Field("Luxury Indian fashion campaign", min_length=3, max_length=2000)
    image_model: str = "flux"
    video_model: str = "wan"
    generate_video: bool = True
    seed: int = Field(-1, ge=-1)
