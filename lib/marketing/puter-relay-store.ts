import { randomUUID } from "node:crypto";

export interface PuterRelayJobPayload {
  prompt: string;
  imageDataUrl: string;
  product: {
    name: string;
    category: string;
    fabric?: string;
    price: number;
  };
  model?: string;
  width: number;
  height: number;
  format: "square" | "portrait";
}

export interface PuterRelayJob {
  id: string;
  payload: PuterRelayJobPayload;
  status: "queued" | "running" | "complete" | "failed";
  createdAt: number;
  updatedAt: number;
  workerId?: string;
  imageDataUrl?: string;
  imageUrl?: string;
  contentType?: string;
  error?: string;
}

type Store = {
  jobs: Map<string, PuterRelayJob>;
  workers: Map<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __thetantiPuterRelayStore: Store | undefined;
}

function store(): Store {
  globalThis.__thetantiPuterRelayStore ??= {
    jobs: new Map<string, PuterRelayJob>(),
    workers: new Map<string, number>(),
  };
  return globalThis.__thetantiPuterRelayStore;
}

export function puterRelayConnected(maxAgeMs = 20_000): boolean {
  const now = Date.now();
  for (const seenAt of store().workers.values()) {
    if (now - seenAt <= maxAgeMs) return true;
  }
  return false;
}

export function heartbeatPuterWorker(workerId: string): void {
  const id = workerId.trim() || "saree-studio";
  store().workers.set(id, Date.now());
}

export function createPuterRelayJob(payload: PuterRelayJobPayload): PuterRelayJob {
  const now = Date.now();
  const job: PuterRelayJob = {
    id: `puter_${randomUUID()}`,
    payload,
    status: "queued",
    createdAt: now,
    updatedAt: now,
  };
  store().jobs.set(job.id, job);
  pruneOldJobs();
  return job;
}

export function claimPuterRelayJob(workerId: string): PuterRelayJob | null {
  heartbeatPuterWorker(workerId);
  const now = Date.now();
  const jobs = [...store().jobs.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const job of jobs) {
    if (job.status !== "queued") continue;
    const next = { ...job, status: "running" as const, workerId, updatedAt: now };
    store().jobs.set(job.id, next);
    return next;
  }
  return null;
}

export function completePuterRelayJob(input: {
  id: string;
  workerId: string;
  imageDataUrl?: string;
  imageUrl?: string;
  contentType?: string;
  error?: string;
}): PuterRelayJob {
  heartbeatPuterWorker(input.workerId);
  const job = store().jobs.get(input.id);
  if (!job) throw new Error("Puter relay job not found");
  if (job.workerId && job.workerId !== input.workerId) throw new Error("Puter relay job belongs to another worker");
  const failed = Boolean(input.error);
  const next: PuterRelayJob = {
    ...job,
    status: failed ? "failed" : "complete",
    updatedAt: Date.now(),
    imageDataUrl: failed ? undefined : input.imageDataUrl,
    imageUrl: failed ? undefined : input.imageUrl,
    contentType: input.contentType,
    error: input.error,
  };
  store().jobs.set(job.id, next);
  return next;
}

export async function waitForPuterRelayJob(id: string, timeoutMs: number): Promise<PuterRelayJob> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = store().jobs.get(id);
    if (!job) throw new Error("Puter relay job disappeared");
    if (job.status === "complete" || job.status === "failed") return job;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  const job = store().jobs.get(id);
  if (!job) throw new Error("Puter relay job disappeared");
  return {
    ...job,
    status: "failed",
    error: "Puter relay timed out. Keep the Saree AI Studio tab open and signed in.",
    updatedAt: Date.now(),
  };
}

function pruneOldJobs(): void {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, job] of store().jobs) {
    if (job.createdAt < cutoff) store().jobs.delete(id);
  }
}
