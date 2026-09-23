# TheTanti AI Shopping Assistant

A floating, production-ready shopping chatbot that runs **entirely in the
customer's browser** — no OpenAI/Gemini/Claude/Groq API keys, no paid AI
services, no server-side inference, no Vercel Function bloat.

```
Chat UI (components/chatbot/)
   ↓ useChat (lib/ai/use-chat.ts)
Chat Controller (lib/ai/controller.ts)
   ├── Intent Detection (lib/ai/intent/)      ← deterministic rules, free
   ├── Knowledge Search (lib/ai/rag/)         ← keyword RAG, in-memory
   ├── Tools (lib/ai/tools/)                  ← products, orders, cart
   ↓
Context Builder (lib/ai/rag/context.ts)
   ↓
Local LLM via Web Worker (lib/ai/model/ → public/ai/worker.js)
   ├── Transformers.js loaded from CDN at runtime
   ├── WebGPU when available, WASM fallback
   ↓
Streamed answer  (or deterministic fallback reply if the model can't run)
```

## Why this architecture

- **No API keys.** Inference happens on-device; the store never pays per token
  and customer questions never leave the browser.
- **No Vercel Function size increase.** Transformers.js (~1 MB) is *never*
  bundled. It is `importScripts()`-ed from jsDelivr inside the Web Worker, and
  model weights stream from Hugging Face's CDN with browser caching. Verified
  after build: **0 of 41 compiled API routes contain any chatbot code, and no
  server chunk contains the AI runtime.**
- **Never broken.** Intent classification and RAG are deterministic
  TypeScript. If the model can't load (old device, no WebGPU/WASM memory,
  offline CDN), the assistant still answers FAQ/policy questions from
  knowledge, runs product search, and shows product cards.
- **Reuses the existing store.** Existing `/api/products`, authenticated
  `/api/account/orders`, `StoreProvider` cart, `useAuth`, design tokens,
  Dexie patterns — nothing duplicated.

## Model used

| | |
|---|---|
| Model | `onnx-community/Qwen2.5-0.5B-Instruct` |
| Quantization | `q4f16` on WebGPU, `q4` on WASM |
| Download size | ≈ 350 MB (one-time, then browser-cached) |
| Why | Best instruction-following quality per MB in the 0.5B class; Apache-2.0; official ONNX community build, so it works with Transformers.js out of the box |
| Location | `lib/ai/config/model.config.ts` |

The whole catalogue is one flat price, so the model only needs to *phrase*
grounded facts (retrieved knowledge + real tool results) — a 0.5B model is
sufficient and keeps first-load realistic on mobile.

### How to change the model

Edit **`lib/ai/config/model.config.ts`** only:

```ts
repo: "onnx-community/Qwen2.5-1.5B-Instruct",  // bigger, ~1 GB
file: "model_q4f16.onnx",
```

Also update the same `MODEL_REPO` constant at the top of
**`public/ai/worker.js`** (the worker is a plain static file and intentionally
does not import the config). Anything in the
[ONNX community catalog](https://huggingface.co/onnx-community) with a
`model_q4f16.onnx` and matching tokenizer works. Bump
`TRANSFORMERS_CDN_SPEC` there if you upgrade Transformers.js itself.

### How to update knowledge

Knowledge chunks live in **`lib/ai/knowledge/*.ts`** and mirror `lib/site.ts`
and the published policy pages. To change an answer:

1. Edit or add a chunk in the relevant file (`shipping.ts`, `returns.ts`, …).
2. Give it a stable `id`, a `category`, and lowercase `keywords` customers
   would actually type.
3. Done — the search index and context builder pick it up automatically.

Rule of thumb: the chatbot must never contradict the website. If the policy
page changes, change the chunk in the same commit.

**Grounding rule (regression-tested in `controller.grounding.test.ts`):**
internal context labels (`KNOWLEDGE:`, `PRODUCT RESULTS:`, `ORDER:`) and
instructions like "Tell the customer…" must never appear in a customer-visible
answer — small models echo whatever sits in the context verbatim, so context
strings are written as neutral facts and the no-LLM fallback composes human
sentences from parts instead of dumping raw context.

### How to add a new intent

1. Add the intent name to the `Intent` union in `lib/ai/types/chat.ts`.
2. Add a rule in `lib/ai/intent/rules.ts` (`INTENT_RULES`) — patterns,
   weight, intent.
3. Optionally scope retrieval by mapping it in `INTENT_KNOWLEDGE`
   (`lib/ai/controller.ts`) and add nav links in `NAV_LINKS`.
4. Add a test in `lib/ai/intent/classifier.test.ts`.

Intents are evaluated by weight; deterministic rules always win before any
LLM call, so simple questions never cost inference.

### How to add a new chatbot tool

1. Create `lib/ai/tools/my-tool.ts` with:
   - a `validate…Input(raw: unknown)` function (hand-rolled validators, the
     project convention) that **throws on anything suspicious** — never trust
     model-generated arguments;
   - a `run…()` function that calls an existing backend API and returns a
     customer-safe projection (no internal ids, no emails, no costs).
2. Register it in `lib/ai/tools/index.ts` (`TOOLS`) for the prompt/tests.
3. Call it from the tool phase in `lib/ai/controller.ts` behind its intent.
4. Render any new UI as a `MessageBlock` (`lib/ai/types/chat.ts`).
5. Add tests: valid args accepted, malformed args rejected, auth enforced.

## RAG architecture

Small and local by design — no vector database:

- `rag/chunks.ts` — normalize + tokenize chunks into an in-memory index.
- `rag/search.ts` — weighted keyword scoring: full keyword-phrase hit ≫
  multi-word partial ≫ token overlap ≫ substring. Returns `[]` when nothing
  is relevant (the controller then gives the honest out-of-scope reply rather
  than fabricating).
- `rag/context.ts` — formats retrieved chunks + tool results into the prompt
  context, and the deterministic fallback text used when the LLM is down.
- `rag/embeddings.ts` — the optional semantic upgrade path (cosine similarity
  helper + flag), **disabled by default**. Enable by setting
  `MODEL_CONFIG.embedding.enabled = true` and loading the embedding model in
  the worker; vectors would live in IndexedDB next to chat history.

## Product tools — no hallucinated products

- `PRODUCT_SEARCH` intent → `extractProductFilters()` parses color / category
  / max/min price from natural language → `validateProductSearchInput()`
  whitelist-checks every field (unknown category slugs are rejected, prices
  are clamped numbers, free text truncated) → `runProductSearch()` calls the
  store's real `/api/products` and narrows by price client-side.
- The prompt only ever contains the real results; the model is told it may
  recommend *only these products, at exactly these prices*.
- Product cards in chat (`components/chatbot/product-result.tsx`) render the
  same data fields as grid cards and reuse `useCart` + `trackAddToCart`.

## Order security

- The order tool (`lib/ai/tools/order-status.ts`) calls the existing
  authenticated `/api/account/orders`. The backend returns only the session
  user's orders; the assistant has no API to fetch someone else's.
- If the visitor is not signed in, the controller short-circuits *before any
  lookup* and suggests `/track` (order number + phone, the existing guest
  path). "Show me order TT12345" cannot bypass authorization — no tool
  accepts an order id from the chat.
- Order blocks in chat show only customer-safe fields (number, status, AWB,
  items, total) — the same data /track already shows.

## Cart integration

The assistant never mutates cart state itself. `parseCartRequest()` validates
a slug against products already shown in the conversation and the UI calls
the existing `StoreProvider.add()` — identical to tapping Add to Cart on a
product card. Guest carts keep working through the same localStorage/Dexie
flow as the rest of the site.

## IndexedDB schema (`lib/ai/storage/indexeddb.ts`)

Dexie database **`thetanti-chat`**, version 1:

| Table | Key | Indexes | Contents |
|---|---|---|---|
| `chat_messages` | `id` (uuid) | `sessionId, createdAt` | role, text, rich blocks, origin flag; TTL 30 days; capped at 60 rows per session |
| `meta` | `key` | — | chat session id, chatbot prefs, model cache metadata |

- Versioned via `chatDb.version(1)`; future migrations add new
  `version(n)` blocks — Dexie upgrades in place, old data preserved.
- **Never stored:** passwords, payment data, auth tokens. Order blocks store
  only the status fields a customer already sees on /track.
- Every API no-ops safely during SSR / private mode / quota errors.

## Model loading UX & WebGPU fallback

- Opening the chat triggers `loadModel()` (also idle-prewarmed ~5s after
  first visit, skipped when `navigator.connection.saveData`).
- The worker picks WebGPU when `navigator.gpu.requestAdapter()` resolves,
  else WASM (`dtype: q4` vs `q4f16`), and reports progress 0–100 which the UI
  renders as "Preparing your shopping assistant…" with a block progress bar.
- While loading — and forever, if it fails — the assistant stays usable:
  intents, knowledge answers, product search and nav links all work.
- On failure the UI shows the non-blocking fallback notice:
  "AI responses are generated on your device when supported…" plus a retry
  button. Generation has a hard 90 s timeout and a Stop button.

## Privacy

- Questions are answered on-device; normal chat messages are **never sent to
  any AI provider** and never logged. The only network calls are the store's
  own APIs for products/orders — exactly the calls the regular UI makes.
- The chat shows the note: *"AI responses are generated on your device when
  supported."*
- Chat history stays in IndexedDB on the customer's device, TTL 30 days,
  clearable via the reset button in the chat header.

## Deployment (Vercel)

Nothing to configure — no env vars, no secrets, no AI regions. The model and
the Transformers.js library are fetched client-side from jsDelivr/Hugging
Face CDNs. Build checks already in CI:

```bash
npm run lint        # chatbot files contribute 0 errors/warnings
npm run typecheck   # clean
npm test            # 207 tests incl. 46 AI tests
npm run build       # verified: no AI code in server bundles
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| "Preparing your shopping assistant…" stuck at 0% | CDN blocked (ad-blocker / restricted network). The assistant still works in fallback mode; check `cdn.jsdelivr.net` reachability. |
| Model never becomes ready on mobile | Old browser without WebGPU and low-memory WASM path. Expected on very old devices; fallback answers continue. |
| Model downloads again on every visit | Browser storage disabled or site data being evicted. Check the IndexedDB/Cache storage isn't cleared on exit. |
| Product cards show "no matching products" | The filter really matched nothing (flat ₹199 catalogue — maxPrice below 199 yields none by design). |
| Order question answered with sign-in prompt | The visitor isn't authenticated — this is the security rule working. |
| Streamed text stops mid-sentence | The 90 s generation timeout hit; regenerate or ask a shorter question. |
| Want different answers | Edit `lib/ai/knowledge/*` — never patch the controller for content changes. |
