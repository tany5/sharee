/**
 * Worker client — the ONLY bridge between the app and the AI worker.
 * The worker file is loaded from jsDelivr at runtime (never bundled), so no
 * server bundle ever contains Transformers.js. All AI traffic flows through
 * this typed facade: load → progress → ready/error, then streaming generate.
 */
import { MODEL_CONFIG, TRANSFORMERS_CDN_SPEC } from "@/lib/ai/config/model.config";
import type { WorkerRequest, WorkerResponse } from "@/lib/ai/types/chat";

export type WorkerState = "unloaded" | "loading" | "ready" | "error";

interface Listener {
  onState?: (state: WorkerState, device?: string) => void;
  onProgress?: (progress: number) => void;
  onToken?: (requestId: number, text: string) => void;
  onDone?: (requestId: number) => void;
  onError?: (requestId: number | undefined, message: string) => void;
}

const WORKER_URL = `https://cdn.jsdelivr.net/npm/${TRANSFORMERS_CDN_SPEC}/dist/transformers.min.js`;

export class WorkerClient {
  private worker: Worker | null = null;
  private listeners = new Set<Listener>();
  private state: WorkerState = "unloaded";
  private device: string | undefined;
  private nextRequestId = 1;
  private generation: { id: number; timer: ReturnType<typeof setTimeout> } | null = null;

  getState(): { state: WorkerState; device?: string } {
    return { state: this.state, device: this.device };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit<K extends keyof Listener>(event: K, ...args: Parameters<NonNullable<Listener[K]>>) {
    for (const l of this.listeners) {
      const fn = l[event] as ((...a: unknown[]) => void) | undefined;
      fn?.(...args);
    }
  }

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    // Classic worker importing the ESM CDN build via importScripts-compatible
    // wrapper — see public/ai/worker.js. Blob URL keeps it same-origin.
    const bootstrap = `importScripts(${JSON.stringify(WORKER_URL.replace("/dist/transformers.min.js", "/dist/transformers.min.js"))});`;
    void bootstrap; // (the real worker script is fetched below)
    this.worker = new Worker("/ai/worker.js");
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.handle(event.data);
    };
    this.worker.onerror = () => {
      this.state = "error";
      this.emit("onState", "error");
      this.emit("onError", undefined, "The AI assistant failed to start on this device.");
    };
    return this.worker;
  }

  private handle(msg: WorkerResponse) {
    switch (msg.type) {
      case "status":
        if (this.state !== "ready" || msg.state !== "loading") {
          this.state = msg.state === "error" ? "error" : msg.state === "idle" ? "unloaded" : msg.state;
          this.emit("onState", this.state);
        }
        break;
      case "progress":
        this.emit("onProgress", Math.max(0, Math.min(100, Math.round(msg.progress))));
        break;
      case "ready":
        this.state = "ready";
        this.device = msg.device;
        this.emit("onState", "ready", msg.device);
        break;
      case "token":
        this.emit("onToken", msg.requestId, msg.text);
        break;
      case "done":
        this.clearGenerationTimer();
        this.emit("onDone", msg.requestId);
        break;
      case "error":
        this.clearGenerationTimer();
        if (msg.requestId === undefined) {
          this.state = "error";
          this.emit("onState", "error");
        }
        this.emit("onError", msg.requestId, msg.message);
        break;
    }
  }

  private clearGenerationTimer() {
    if (this.generation) {
      clearTimeout(this.generation.timer);
      this.generation = null;
    }
  }

  /** Ask the worker to load the model; progress arrives via onProgress. */
  load(): void {
    if (this.state === "loading" || this.state === "ready") return;
    this.state = "loading";
    this.emit("onState", "loading");
    this.ensureWorker().postMessage({ type: "load" } satisfies WorkerRequest);
  }

  /** Stream a generation. Returns the request id. */
  generate(prompt: string, onToken: (text: string) => void, onDone: () => void, onError: (message: string) => void): number {
    const id = this.nextRequestId++;
    let acc = "";
    const unsub = this.subscribe({
      onToken: (rid, text) => {
        if (rid === id) {
          acc += text;
          onToken(text);
        }
      },
      onDone: (rid) => {
        if (rid !== id) return;
        unsub();
        onDone();
      },
      onError: (rid, message) => {
        if (rid !== id && rid !== undefined) return;
        if (rid === undefined) {
          // Worker-level error while generating — surface to this request.
          if (acc.length === 0) onError(message);
          unsub();
          return;
        }
        unsub();
        onError(message);
      },
    });
    // Generation timeout guard.
    const timer = setTimeout(() => {
      this.interrupt(id);
      unsub();
      onError("The assistant took too long to respond. Please try again.");
    }, MODEL_CONFIG.generationTimeoutMs);
    this.generation = { id, timer };
    this.ensureWorker().postMessage({ type: "generate", requestId: id, prompt } satisfies WorkerRequest);
    return id;
  }

  /** Cancel an in-flight generation (stop button). */
  interrupt(requestId?: number): void {
    this.clearGenerationTimer();
    const rid = requestId ?? this.generation?.id;
    if (rid === undefined) return;
    this.ensureWorker().postMessage({ type: "interrupt", requestId: rid } satisfies WorkerRequest);
  }

  destroy(): void {
    this.clearGenerationTimer();
    this.worker?.terminate();
    this.worker = null;
    this.state = "unloaded";
    this.device = undefined;
  }
}

/** Singleton — one worker per browser tab. */
let singleton: WorkerClient | null = null;
export function getWorkerClient(): WorkerClient {
  if (!singleton) singleton = new WorkerClient();
  return singleton;
}
