/**
 * Inference facade — feature detection + a promise-style wrapper around the
 * worker client. UI code never touches the worker protocol directly.
 */
import { MODEL_CONFIG } from "@/lib/ai/config/model.config";
import { getWorkerClient, type WorkerState } from "./client";

/** WebGPU support probe (async: browsers expose it on navigator). */
export async function isWebGPUAvailable(): Promise<boolean> {
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
    if (!gpu) return false;
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

export interface ModelStatus {
  state: WorkerState;
  device?: string;
}

/** Load the model (idempotent). Progress flows through onProgress. */
export function loadModel(): void {
  getWorkerClient().load();
}

export function onModelProgress(cb: (progress: number) => void): () => void {
  return getWorkerClient().subscribe({ onProgress: cb });
}

export function onModelState(
  cb: (state: WorkerState, device?: string) => void,
): () => void {
  return getWorkerClient().subscribe({ onState: cb });
}

export interface GenerateOptions {
  onToken: (text: string) => void;
  signal?: { aborted: boolean };
}

/**
 * Generate a completion for the given full prompt (system + context + user).
 * Resolves with the final text; rejects on error/timeout.
 */
export function generate(prompt: string, opts: GenerateOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    let acc = "";
    let settled = false;
    const client = getWorkerClient();

    const settle = (value: string) => {
      clearInterval(check);
      settled = true;
      resolve(value);
    };
    const fail = (message: string) => {
      clearInterval(check);
      settled = true;
      reject(new Error(message));
    };

    // Abort poll: when the user hits Stop, interrupt the worker and settle
    // with whatever text already streamed.
    const check = setInterval(() => {
      if (opts.signal?.aborted) {
        client.interrupt();
        if (!settled) settle(acc.trim());
      }
    }, 150);

    client.generate(
      prompt,
      (token) => {
        if (opts.signal?.aborted) return;
        acc += token;
        opts.onToken(token);
      },
      () => {
        if (!settled) settle(acc.trim());
      },
      (message) => {
        if (!settled) fail(message);
      },
    );
  });
}

export { MODEL_CONFIG };
