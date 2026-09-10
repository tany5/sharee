import "server-only";

/**
 * Kaggle FLUX.2 Klein try-on provider — drives the free Kaggle GPU from the
 * store admin. Lifecycle per product:
 *
 *   1. submitKaggleTryOn()  → write job.json + person + saree into the kernel
 *                             input dataset dir, push the kernel via the Kaggle CLI
 *   2. kaggleRunStatus()    → poll `kaggle kernels status` while the admin
 *                             editor loop continues
 *   3. fetchKaggleOutputs() → when COMPLETE, `kaggle kernels output` the
 *                             per-pose PNGs and return them for upload
 *
 * Credentials: ~/.kaggle/kaggle.json (never read into the app; the CLI uses it
 * directly). Python + the `kaggle` package must be on PATH.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type KagglePose = "front" | "side" | "back" | "full_saree";

export const KAGGLE_KERNEL_SLUG = "thetanti-flux2-saree-job";
export const KAGGLE_KERNEL_PATH = "D:/TheTanti-AI/kaggle/flux2-saree-job-kernel";
/** Dataset dir the kernel reads its job inputs from (pushed with the kernel). */
export const KAGGLE_DATASET_DIR = "D:/TheTanti-AI/kaggle/flux2-saree-job-kernel/input";
/** Where downloaded Kaggle outputs are mirrored for the local gallery. */
export const KAGGLE_DOWNLOAD_DIR = process.env.TRYON_DOWNLOAD_DIR ?? "D:/TheTanti-AI/generated/tryon-downloads";

const KAGGLE_USERNAME = "tanmay94dey";

function run(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { windowsHide: true, shell: false });
    let out = "";
    let err = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ code: -1, out, err: `${err}${e.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, out, err });
    });
  });
}

async function kaggleCli(args: string[], timeoutMs = 120_000) {
  const res = await run("kaggle", args, timeoutMs);
  if (res.code !== 0 && /not recognized|ENOENT|No module named/i.test(res.err)) {
    // Windows fallback: python -m kaggle
    const alt = await run("python", ["-m", "kaggle", ...args], timeoutMs);
    return alt;
  }
  return res;
}

export interface KaggleJobInput {
  slug: string;
  personImagePath: string; // absolute local path to the model photo
  sareeImagePath: string; // absolute local path to the product photo
  poses: KagglePose[];
  colorHint?: string;
  fabric?: string;
  productName?: string;
  seedBase?: number;
  width?: number;
  height?: number;
  steps?: number;
}

/** Validate that the Kaggle CLI is usable before promising anything. */
export async function kaggleAvailable(): Promise<boolean> {
  const res = await kaggleCli(["kernels", "list", "--mine", "-p", "1"]);
  return res.code === 0;
}

/**
 * Stage job inputs + kernel metadata, then push. Kaggle clones the dataset
 * at /kaggle/input/thetanti-saree-tryon-input for the run.
 */
export async function submitKaggleTryOn(job: KaggleJobInput): Promise<{ ok: boolean; error?: string }> {
  try {
    fs.mkdirSync(KAGGLE_DATASET_DIR, { recursive: true });
    fs.copyFileSync(job.personImagePath, path.join(KAGGLE_DATASET_DIR, "person.png"));
    const sareeExt = path.extname(job.sareeImagePath).toLowerCase() === ".png" ? "saree.png" : "saree.jpg";
    fs.copyFileSync(job.sareeImagePath, path.join(KAGGLE_DATASET_DIR, sareeExt));
    fs.writeFileSync(
      path.join(KAGGLE_DATASET_DIR, "job.json"),
      JSON.stringify(
        {
          slug: job.slug,
          person: "person.png",
          saree: sareeExt,
          poses: job.poses,
          seed_base: job.seedBase ?? 9137,
          width: job.width ?? 448,
          height: job.height ?? 672,
          steps: job.steps ?? 8,
          guidance: 3.5,
          color_hint: job.colorHint ?? "",
          fabric: job.fabric ?? "silk",
          product: job.productName ?? job.slug,
        },
        null,
        2,
      ),
    );

    // Kernel metadata points at run_flux2_job_kaggle.py and lists the dataset.
    fs.writeFileSync(
      path.join(KAGGLE_KERNEL_PATH, "kernel-metadata.json"),
      JSON.stringify(
        {
          id: `${KAGGLE_USERNAME}/${KAGGLE_KERNEL_SLUG}`,
          title: "TheTanti FLUX2 Saree Job",
          code_file: "run_flux2_job_kaggle.py",
          language: "python",
          kernel_type: "script",
          is_private: true,
          enable_gpu: true,
          enable_internet: true,
          dataset_sources: ["tanmay94dey/thetanti-saree-tryon-input"],
        },
        null,
        2,
      ),
    );

    // Push the dataset (the input dir itself, so job.json sits at the dataset
    // root → /kaggle/input/thetanti-saree-tryon-input/job.json) then the kernel.
    const dsMeta = path.join(KAGGLE_DATASET_DIR, "dataset-metadata.json");
    fs.writeFileSync(
      dsMeta,
      JSON.stringify(
        {
          title: "thetanti-saree-tryon-input",
          id: `${KAGGLE_USERNAME}/thetanti-saree-tryon-input`,
          licenses: [{ name: "CC0-1.0" }],
        },
        null,
        2,
      ),
    );
    const dsPush = await kaggleCli(["datasets", "version", "-p", KAGGLE_DATASET_DIR, "-m", `job ${job.slug} ${Date.now()}`], 300_000);
    if (dsPush.code !== 0 && !/already exists|up-to-date|successfully/i.test(dsPush.out + dsPush.err)) {
      const createRes = await kaggleCli(["datasets", "create", "-p", KAGGLE_DATASET_DIR], 300_000);
      if (createRes.code !== 0 && !/already exists/i.test(createRes.out + createRes.err)) {
        return { ok: false, error: `dataset push failed: ${(createRes.err || createRes.out).slice(0, 300)}` };
      }
      const retry = await kaggleCli(["datasets", "version", "-p", KAGGLE_DATASET_DIR, "-m", `job ${job.slug}`], 300_000);
      if (retry.code !== 0 && !/successfully|up-to-date/i.test(retry.out + retry.err)) {
        return { ok: false, error: `dataset version failed: ${(retry.err || retry.out).slice(0, 300)}` };
      }
    }

    const push = await kaggleCli(["kernels", "push", "-p", KAGGLE_KERNEL_PATH], 180_000);
    if (push.code !== 0) {
      return { ok: false, error: `kernel push failed: ${(push.err || push.out).slice(0, 300)}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type KaggleRunState = "NO_SESSION" | "QUEUED" | "RUNNING" | "COMPLETE" | "ERROR" | "CANCEL_ACKNOWLEDGED" | "UNKNOWN";

/** Poll the kernel's latest run status. */
export async function kaggleRunStatus(): Promise<{ state: KaggleRunState; message?: string }> {
  const res = await kaggleCli(["kernels", "status", `${KAGGLE_USERNAME}/${KAGGLE_KERNEL_SLUG}`], 60_000);
  const text = `${res.out}\n${res.err}`;
  // CLI prints: has status "KernelWorkerStatus.RUNNING" (or a JSON body).
  // Take the segment after the last dot and normalize, so both
  // "KernelWorkerStatus.RUNNING" and plain "RUNNING" parse correctly.
  const match =
    text.match(/"status"\s*:\s*"([A-Za-z_.]+)"/) ?? text.match(/status\s*:?\s*"?([A-Za-z_.]+)"?/);
  const raw = match?.[1] ?? "";
  const tail = raw.includes(".") ? raw.split(".").pop()! : raw;
  const state = (tail.toUpperCase() || "UNKNOWN") as KaggleRunState;
  return { state, message: text.trim().slice(0, 300) };
}

/**
 * Download finished outputs into a local dir. Returns pose → file map for
 * files that exist after the download attempt.
 */
export async function fetchKaggleOutputs(
  slug: string,
  poses: KagglePose[],
  destDir = path.join(os.tmpdir(), "thetanti-kaggle", slug),
): Promise<Record<KagglePose, string>> {
  // CLI 2.2.x form: kaggle kernels output <owner>/<slug> -p <folder> [-q]
  const res = await kaggleCli(
    ["kernels", "output", `${KAGGLE_USERNAME}/${KAGGLE_KERNEL_SLUG}`, "-p", destDir, "-q"],
    300_000,
  );
  const out: Partial<Record<KagglePose, string>> = {};
  if (res.code !== 0) return out as Record<KagglePose, string>;
  for (const pose of poses) {
    const file = path.join(destDir, `${slug}-${pose}.png`);
    if (fs.existsSync(file) && fs.statSync(file).size > 20_000) out[pose] = file;
  }
  return out as Record<KagglePose, string>;
}
