from pydantic import BaseModel, Field, field_validator


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=3, max_length=2000)
    negative_prompt: str = Field("", max_length=2000)
    model: str = "flux"
    width: int = Field(1024, ge=256, le=2048)
    height: int = Field(1024, ge=256, le=2048)
    steps: int = Field(28, ge=1, le=80)
    guidance: float = Field(3.5, ge=0, le=20)
    seed: int = Field(-1, ge=-1)
    num_images: int = Field(1, ge=1, le=4)

    @field_validator("prompt")
    @classmethod
    def prompt_not_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("prompt is required")
        return stripped
