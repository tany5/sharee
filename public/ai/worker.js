/**
 * TheTanti AI worker — runs Transformers.js ENTIRELY in the browser.
 *
 * Loaded as a classic worker from /ai/worker.js (a static public file), which
 * importScripts() the Transformers.js build from jsDelivr. This keeps the
 * library AND the model files OUT of the Next.js bundle entirely — nothing
 * AI-related ships in Vercel Functions.
 *
 * Protocol (lib/ai/types/chat.ts):
 *   in:  { type:"load" } | { type:"generate", requestId, prompt } | { type:"interrupt", requestId }
 *   out: { type:"status"|"progress"|"ready"|"token"|"done"|"error", ... }
 */
"use strict";

var T = null; // Transformers.js module (lazy)
var model = null; // AutoModelForCausalLM instance
var tokenizer = null;
var loadingPromise = null;
var currentDevice = null;
/** requestId -> InterruptableStoppingCriteria instance */
var activeStoppers = Object.create(null);

var MODEL_REPO = "onnx-community/Qwen2.5-0.5B-Instruct";
var MAX_NEW_TOKENS = 220;

function post(msg) {
  self.postMessage(msg);
}

function status(state) {
  post({ type: "status", state: state });
}

/** Best available device: WebGPU when present, WASM otherwise. */
async function pickDevice() {
  try {
    if (typeof navigator !== "undefined" && navigator.gpu) {
      var adapter = await navigator.gpu.requestAdapter();
      if (adapter) return "webgpu";
    }
  } catch {
    /* fall through to wasm */
  }
  return "wasm";
}

async function load() {
  if (model) {
    post({ type: "ready", device: currentDevice });
    return;
  }
  if (loadingPromise) return loadingPromise;

  status("loading");

  loadingPromise = (async function () {
    // 1. Library from the CDN — browser HTTP-caches it after the first load.
    if (!T) {
      var url =
        "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.0/dist/transformers.min.js";
      try {
        self.importScripts(url);
      } catch {
        throw new Error("Could not fetch the AI library. Check your connection and retry.");
      }
      T = self.transformers;
      if (!T || !T.AutoTokenizer || !T.AutoModelForCausalLM) {
        throw new Error("The AI library could not be initialised on this device.");
      }
      if (T.env) {
        // Cache model weights in the browser (Cache API) — repeat visits and
        // offline sessions reuse the copy; nothing sensitive is stored.
        T.env.useBrowserCache = true;
        T.env.allowLocalModels = false;
      }
    }

    // 2. Device: WebGPU when present, WASM fallback otherwise.
    currentDevice = await pickDevice();

    // 3. Tokenizer + model with download-progress reporting.
    tokenizer = await T.AutoTokenizer.from_pretrained(MODEL_REPO);
    var lastProgress = 0;
    model = await T.AutoModelForCausalLM.from_pretrained(MODEL_REPO, {
      dtype: currentDevice === "webgpu" ? "q4f16" : "q4",
      device: currentDevice,
      progress_callback: function (info) {
        if (!info) return;
        var p = -1;
        if (info.status === "progress" && typeof info.progress === "number") {
          p = Math.round(info.progress);
        } else if (info.status === "progress" && info.loaded && info.total) {
          p = Math.round((info.loaded / info.total) * 100);
        } else if (info.status === "done" || info.status === "ready") {
          p = 100;
        }
        if (p > lastProgress) {
          lastProgress = p;
          post({ type: "progress", progress: p });
        }
      },
    });

    post({ type: "progress", progress: 100 });
    post({ type: "ready", device: currentDevice });
    status("ready");
  })();

  try {
    await loadingPromise;
  } catch (err) {
    loadingPromise = null;
    model = null;
    status("error");
    post({
      type: "error",
      message: (err && err.message) || "The AI model could not be loaded on this device.",
    });
  }
}

async function generate(requestId, prompt) {
  if (!model || !tokenizer || !T) {
    post({ type: "error", requestId: requestId, message: "AI model is not loaded yet." });
    return;
  }

  var stopper = null;
  try {
    if (T.InterruptableStoppingCriteria) {
      stopper = new T.InterruptableStoppingCriteria();
      activeStoppers[requestId] = stopper;
    }

    var streamer = new T.TextStreamer(tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: function (text) {
        if (text) post({ type: "token", requestId: requestId, text: text });
      },
    });

    var inputs = tokenizer(prompt);
    var inputIds = inputs && inputs.input_ids ? inputs.input_ids : inputs;

    var options = {
      max_new_tokens: MAX_NEW_TOKENS,
      do_sample: true,
      temperature: 0.4,
      top_p: 0.9,
      repetition_penalty: 1.15,
      streamer: streamer,
    };
    if (stopper) options.stopping_criteria = stopper;

    await model.generate(inputIds, options);
    post({ type: "done", requestId: requestId });
  } catch (err) {
    post({
      type: "error",
      requestId: requestId,
      message: (err && err.message) || "Generation failed on this device.",
    });
  } finally {
    if (stopper) delete activeStoppers[requestId];
  }
}

self.onmessage = function (event) {
  var msg = event.data || {};
  if (msg.type === "load") {
    load();
  } else if (msg.type === "generate") {
    generate(msg.requestId, msg.prompt);
  } else if (msg.type === "interrupt") {
    var stopper = activeStoppers[msg.requestId];
    if (stopper) {
      try {
        stopper.interrupt();
      } catch {
        /* already gone */
      }
    }
  }
};
