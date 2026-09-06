/**
 * Pipeline storage helpers — upload generated assets to the public Supabase
 * buckets created by migration 0004 (`base-models`, `model-renders`, `reels`).
 * Demo mode keeps files on disk via the demo store and serves them through
 * /api/media.
 */
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseBackend } from "@/lib/backend/env";

export type PipelineBucket = "base-models" | "model-renders" | "reels";

/**
 * Demo mode writes into the demo store's uploads folder (served by
 * /api/media, hex filenames — same convention as product photos).
 */
function demoUploadsDir(): string {
  const dir = path.join(process.cwd(), ".demo-data", "uploads");
  mkdirSync(dir, { recursive: true });
  return dir;
}

export interface StoredAsset {
  /** Displayable public URL. */
  url: string;
  /** Bucket path (used to clean up / re-derive). */
  storagePath?: string;
}

/** Upload bytes to a pipeline bucket; returns its public URL. */
export async function uploadPipelineAsset(
  bucket: PipelineBucket,
  filename: string,
  data: Uint8Array | Buffer,
  contentType: string,
): Promise<StoredAsset> {
  const safe = filename.replace(/[^a-z0-9._-]/gi, "-").slice(-80);
  if (isSupabaseBackend()) {
    const supabase = await supabaseServer();
    const storagePath = `${Date.now()}-${randomUUID().slice(0, 8)}-${safe}`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(storagePath, data, { contentType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    return { url: pub.publicUrl, storagePath };
  }
  // Demo mode: hex name in the uploads dir, served by /api/media.
  const ext = (safe.split(".").pop() ?? "jpg").toLowerCase();
  const file = `${randomBytes(10).toString("hex")}.${ext}`;
  writeFileSync(path.join(demoUploadsDir(), file), data);
  return { url: `/api/media/${file}`, storagePath: file };
}

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
};

/** Download an image (or read a demo-mode local file) as bytes. */
export async function fetchImageBytes(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  // Demo storage returns relative /api/media URLs — read the file from disk
  // (server-side fetch cannot resolve relative URLs).
  if (url.startsWith("/")) {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.basename(url.replace("/api/media/", ""));
    const abs = path.join(process.cwd(), ".demo-data", "uploads", file);
    if (!fs.existsSync(abs)) throw new Error(`Stored asset not found on disk: ${file}`);
    const ext = file.split(".").pop()?.toLowerCase() ?? "jpg";
    return { bytes: fs.readFileSync(abs), contentType: EXT_TYPES[ext] ?? "image/jpeg" };
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Could not fetch image (${res.status}): ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  return { bytes: buf, contentType: type };
}
