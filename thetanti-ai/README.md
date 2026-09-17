# TheTanti AI Generation Backend

Self-hosted FastAPI layer for TheTanti image and vertical reel video generation.
The storefront talks only to this API; ComfyUI stays private on the GPU host.

## What is included

- Versioned API under `/api/v1`
- API-key authentication via `Authorization: Bearer THE_TANTI_API_KEY`
- Async in-memory GPU queue with one worker by default
- Image, image-to-image, text-to-video, image-to-video, job, file and fashion endpoints
- Local storage abstraction under `storage/`
- ComfyUI adapter boundary and workflow template folder
- Kaggle-friendly startup scripts
- Mock generation mode for tests and non-GPU development

Video requests are normalized to Instagram Reel resolution: `1080x1920`.

## Quick start

```bash
cd thetanti-ai
python -m pip install -r requirements.txt
python -m uvicorn api.main:app --reload
```

Open:

- API docs: `http://127.0.0.1:8000/docs`
- Health: `http://127.0.0.1:8000/api/v1/health`

## Required environment

Copy `.env.example` to `.env` and set:

```env
THE_TANTI_API_KEY=change-me
COMFYUI_HOST=127.0.0.1
COMFYUI_PORT=8188
COMFYUI_ENABLED=false
MOCK_GENERATION=true
LOCAL_TRYON_URL=http://127.0.0.1:8787/model-images
QWEN_API_ENDPOINT=https://dashscope-intl.aliyuncs.com/api/v1
QWEN_IMAGE_MODEL=qwen-image-edit
QWEN_MODEL_REF_PATH=../public/marketing/models/bengali-model-01.png
```

Do not commit real keys. Local keys for this PC remain under
`D:\thetanti\secret\secret\`.

For saree drape/image-edit jobs, start the local TheTanti engine and ComfyUI:

```bat
D:\TheTanti-AI\start-comfyui.cmd
D:\TheTanti-AI\start-engine.cmd
```

Then call `/api/v1/images/edit`; the API bridges to
`LOCAL_TRYON_URL` and stores the generated full-body model image under
`storage/outputs/<job_id>/result.png`.

To force Qwen Image Edit instead, send `model=qwen_image` in the multipart
request. The API uses `QWEN_API_KEY` / `DASHSCOPE_API_KEY` when set, otherwise
it discovers the local DashScope API-key CSV under `../secret/secret/`.

## curl tests

```bash
curl -X POST http://localhost:8000/api/v1/images/generations \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A luxury Indian fashion model wearing an elegant red saree","model":"flux","width":1024,"height":1024}'
```

```bash
curl -H "Authorization: Bearer change-me" \
  http://localhost:8000/api/v1/jobs/img_123
```

```bash
curl -X POST http://localhost:8000/api/v1/videos/generations \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Cinematic fashion commercial","model":"wan","duration":5,"width":832,"height":480}'
```

The video job stores `1080x1920` even when clients send another size.

## Model licensing

Before enabling real model downloads, verify current license and commercial
terms. Initial candidates:

| Model | Role | Source | License/commercial status | Notes |
| --- | --- | --- | --- | --- |
| FLUX | image | Confirm before download | Not bundled | Add exact variant and terms here |
| Qwen Image | image | Confirm before download | Not bundled | Optional |
| Wan | video | Confirm before download | Not bundled | Initial video target |
| LTX | video | Confirm before download | Not bundled | Optional fallback |

Open weights are not automatically unrestricted. This repo intentionally does
not download or package model weights until the license check is explicit.
