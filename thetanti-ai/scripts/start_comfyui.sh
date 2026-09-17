#!/usr/bin/env bash
set -euo pipefail

COMFYUI_DIR="${COMFYUI_DIR:-$PWD/ComfyUI}"
if [ ! -d "$COMFYUI_DIR" ]; then
  echo "ComfyUI not found at $COMFYUI_DIR. Run scripts/install_comfyui.sh first."
  exit 1
fi

cd "$COMFYUI_DIR"
python main.py --listen "${COMFYUI_HOST:-127.0.0.1}" --port "${COMFYUI_PORT:-8188}"
