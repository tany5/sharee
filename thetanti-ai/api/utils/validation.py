ALLOWED_IMAGE_TYPES = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
}

REEL_WIDTH = 1080
REEL_HEIGHT = 1920


def ensure_reel_resolution(width: int | None, height: int | None) -> tuple[int, int]:
    return REEL_WIDTH, REEL_HEIGHT
