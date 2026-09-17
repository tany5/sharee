#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

python - <<'PY'
try:
    import torch
    print("GPU:", torch.cuda.get_device_name(0) if torch.cuda.is_available() else "not available")
except Exception:
    print("GPU: torch not installed; API can still start in mock mode")
PY

mkdir -p storage/inputs storage/outputs storage/temp

echo "================================"
echo "THE TANTI AI SERVER"
echo "================================"
echo "ComfyUI: http://${COMFYUI_HOST:-127.0.0.1}:${COMFYUI_PORT:-8188}"
echo "API: http://${API_HOST:-0.0.0.0}:${API_PORT:-8000}"
echo "Video: vertical reels ${REEL_WIDTH:-1080}x${REEL_HEIGHT:-1920}"
echo "================================"

python -m uvicorn api.main:app --host "${API_HOST:-0.0.0.0}" --port "${API_PORT:-8000}"
