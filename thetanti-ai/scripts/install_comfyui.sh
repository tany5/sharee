#!/usr/bin/env bash
set -euo pipefail

COMFYUI_DIR="${COMFYUI_DIR:-$PWD/ComfyUI}"
if [ -d "$COMFYUI_DIR/.git" ]; then
  echo "ComfyUI already installed: $COMFYUI_DIR"
  exit 0
fi

git clone https://github.com/comfyanonymous/ComfyUI.git "$COMFYUI_DIR"
python -m pip install -r "$COMFYUI_DIR/requirements.txt"
