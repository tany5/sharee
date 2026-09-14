# Cloudflare Workers AI — Product Image Generation

An additional image-generation provider for TheTanti product photos, alongside the existing Puter browser relay. Switching is an `.env.local` change — no code edits.

```
Browser → Next.js API route (/api/ai/generate-product-image)
              → lib/ai/image-provider.ts
                  ├─ provider=cloudflare → Cloudflare Worker → env.AI → FLUX.2 klein
                  └─ provider=puter      → existing Puter browser relay (put.ai.txt2img)
              → normalized result → preview in Admin → your approval → Save
```

Nothing is auto-published: the generated image is a preview until you press **Use this image** + **Save**, and the product keeps its Draft status.

---

## 1. Install Wrangler

```bash
cd D:\thetanti\cloudflare\image-worker
npm install        # pulls wrangler locally for this worker
npx wrangler --version
```

## 2. Log in to Cloudflare

```bash
npx wrangler login     # opens the browser; Workers AI needs a plan with the free AI allocation
```

Check access:

```bash
npx wrangler whoami
```

## 3. Start the worker locally

```bash
cd D:\thetanti\cloudflare\image-worker
npx wrangler dev       # → http://localhost:8787
```

> `wrangler dev` runs the worker code locally while inference goes to the **real** Workers AI service using your logged-in account — there is no fake local model.

Smoke checks:

```
http://localhost:8787/         → {"service":"TheTanti Image Worker","status":"ok"}
http://localhost:8787/health   → {"status":"ok"}
```

## 4. Point the app at the worker

In `D:\thetanti\.env.local`:

```env
IMAGE_GENERATION_PROVIDER=cloudflare
CLOUDFLARE_IMAGE_WORKER_URL=http://localhost:8787
CLOUDFLARE_IMAGE_WORKER_SECRET=
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b
```

Restart `npm run dev` after changing `.env.local`.

## 5. Switch providers

```env
# Use Cloudflare:
IMAGE_GENERATION_PROVIDER=cloudflare

# Use the existing Puter flow:
IMAGE_GENERATION_PROVIDER=puter
```

Restart Next.js. The badge in **Admin → Products → (Add/Edit saree) → Photos → Test AI Image** shows the active provider.

## 6. Deploy the worker (production)

```bash
cd D:\thetanti\cloudflare\image-worker
npx wrangler deploy
# → https://thetanti-image-worker.<your-subdomain>.workers.dev
```

Then in `.env.local`:

```env
CLOUDFLARE_IMAGE_WORKER_URL=https://thetanti-image-worker.<your-subdomain>.workers.dev
CLOUDFLARE_IMAGE_WORKER_SECRET=<a long random string>
```

Set the matching secret on the worker:

```bash
npx wrangler secret put CLOUDFLARE_IMAGE_WORKER_SECRET
```

Restrict CORS for production in `wrangler.jsonc`:

```jsonc
"vars": { "ALLOWED_ORIGIN": "https://your-domain.com" }
```

## 7. Test from the admin

1. **Admin → Products → Add saree** (or edit one).
2. Upload a saree photo (+ make sure a model exists in **Admin → Saree Models**).
3. In **Photos → Test AI Image**, press **Generate with Cloudflare**.
4. Wait — first request after a cold start can take a while.
5. Review the preview (provider · model · duration are shown). **Use this image** adds it to the product photos; **Discard** throws it away. Nothing publishes automatically.

## 8. Changing the model

The model is worker config, not app code:

```env
# .env.local (only affects the label/status in the app)
CLOUDFLARE_IMAGE_MODEL=@cf/black-forest-labs/flux-2-klein-4b
```

```bash
# The worker reads its own env var — set it in wrangler.jsonc [vars] or:
npx wrangler secret put CLOUDFLARE_IMAGE_MODEL   # e.g. @cf/black-forest-labs/flux-2-klein-9b
```

The worker always reports the model it actually used, and the app displays that.

## 9. Troubleshooting

| Error | Meaning / fix |
|---|---|
| "Cloudflare image worker is unavailable" | Worker not running or wrong URL. Start `npx wrangler dev`, check `CLOUDFLARE_IMAGE_WORKER_URL`. |
| "rejected the request (401/403)" | `CLOUDFLARE_IMAGE_WORKER_SECRET` mismatch (or set on one side only). |
| "daily free allocation may have been reached" | Workers AI free daily Neuron allocation exhausted — retry after the daily reset. |
| "Model returned no image" | The model's safety filter likely refused an input — try a different saree/model photo. |
| "timed out" | Cold start or queue — press the button again. |
| Login works but generation 404s | The worker route is `/generate` (POST). `/` and `/health` are GET smoke checks. |

## 10. Free quota — read this first

Workers AI **Free** provides a daily allocation of Neurons that **resets daily**. It is *not* unlimited: a FLUX.2 generation is billed per 512×512 output tile (see the [model pricing](https://developers.cloudflare.com/workers-ai/models/flux-2-klein-4b/)). Budget accordingly — that is why the test flow generates **one** image per click and never batches poses automatically.

## Notes on fidelity (saree preservation)

FLUX.2 klein accepts up to **4 reference images** (`input_image_0..3`, each ≤ 512×512 per Cloudflare's docs; the worker downsizes references when the Images binding is available). The default prompt orders: image 1 = model, image 2 = saree (source of truth). The saree reference is sent at the highest practical quality — heavy compression is deliberately avoided so border/pallu/print survive.

Puter, by contrast, is text-to-image only — it cannot take pixel references. The saree description is folded into the prompt instead. For strict saree preservation, test Cloudflare (or the existing Kaggle FLUX pipeline) rather than Puter.
