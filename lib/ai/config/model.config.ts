/**
 * AI model configuration — the single place to change the browser LLM.
 *
 * The model runs IN THE CUSTOMER'S BROWSER via Transformers.js, loaded from
 * the jsDelivr CDN at runtime (never bundled — see docs/thetanti-chatbot.md).
 * No API key, no server inference, no Vercel Function involvement.
 */

/** Name of the shared jsDelivr URL stored in package.json "dependencies". */
export const TRANSFORMERS_CDN_SPEC = "@huggingface/transformers@4.3.0";

export const MODEL_CONFIG = {
  /**
   * Hugging Face repo + file of the instruction-tuned model.
   * Qwen2.5-0.5B-Instruct: ~350 MB q4f16, strong instruction following for
   * its size, Apache-2.0. Swap the repo/file here to change the model —
   * see docs/thetanti-chatbot.md → "How to change the model".
   */
  repo: "onnx-community/Qwen2.5-0.5B-Instruct",
  file: "model_q4f16.onnx",

  /** ONNX Runtime device preference. The worker tries webgpu, then wasm. */
  devicePreference: ["webgpu", "wasm"] as ("webgpu" | "wasm")[],

  /** Generation caps — small model, short useful answers, hard stop. */
  maxNewTokens: 220,
  /** Hard wall for one generation (covers first-token WebGPU warmup too). */
  generationTimeoutMs: 90_000,

  /**
   * Embedding model for the OPTIONAL semantic upgrade of RAG (see
   * lib/ai/rag/embeddings.ts). Not loaded by default — the keyword search
   * handles the knowledge base well at this size.
   */
  embedding: {
    repo: "onnx-community/all-MiniLM-L6-v2",
    file: "onnx/model_qint8_avx512_vnni.onnx",
    enabled: false,
  },
} as const;

export type ModelConfig = typeof MODEL_CONFIG;
