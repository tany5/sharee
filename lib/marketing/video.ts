/**
 * Stage 4 — Programmatic vertical reel assembly (FFmpeg).
 *
 * 10s vertical 9:16 (1080×1920), two 5s scenes with a 0.8s crossfade:
 *   Scene A — AI try-on render (model wearing the saree)
 *   Scene B — raw saree fabric close-up
 * Burned-in bottom-third banner: "DAILY WEAR SAREE · ONLY ₹199" +
 * "Cash on Delivery Available | Link in Bio to Order".
 *
 * Music is optional (MUSIC_URL secret not yet wired); videos render silent —
 * Meta accepts silent reels, and adding a track later is a one-line change
 * (add `-i music` + `-map 2:a -shortest`).
 */
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface ReelInput {
  /** Scene A: AI try-on render of the model wearing the saree. */
  tryOnBytes: Buffer;
  /** Scene B: raw saree fabric close-up. */
  fabricBytes: Buffer;
  price: number;
  productName: string;
}

export interface ReelResult {
  mp4: Buffer;
  engine: "ffmpeg";
  durationSec: number;
}

const ffmpegPath = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const bin = require("ffmpeg-static") as string | null;
  if (!bin) throw new Error("ffmpeg-static binary missing");
  return bin;
};

/** Run ffmpeg, collecting stderr; resolve with the output file bytes. */
async function runFfmpeg(args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath(), args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
      // Keep logs bounded.
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve(Buffer.alloc(0));
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-600)}`));
    });
  });
}

function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/:/g, "\\:")
    .replace(/'/g, "\u2019")
    .replace(/%/g, "\\%");
}

/**
 * Assemble the reel. Deterministic, no network: takes both scene images,
 * renders with the static ffmpeg binary, returns the MP4 bytes.
 */
export async function renderReel(input: ReelInput): Promise<ReelResult> {
  const dir = await mkdtemp(path.join(tmpdir(), "reel-"));
  try {
    const sceneA = path.join(dir, "a.png");
    const sceneB = path.join(dir, "b.png");
    const out = path.join(dir, "reel.mp4");

    // Normalise both scenes to 1080x1920 cover crops.
    const sharp = (await import("sharp")).default;
    const norm = (bytes: Buffer) =>
      sharp(bytes)
        .resize(1080, 1920, { fit: "cover", position: "attention" })
        .png()
        .toBuffer();
    await writeFile(sceneA, await norm(input.tryOnBytes));
    await writeFile(sceneB, await norm(input.fabricBytes));

    const primary = escapeDrawText(`DAILY WEAR SAREE · ONLY ₹${input.price}`);
    const secondary = escapeDrawText("Cash on Delivery Available | Link in Bio to Order");
    const brand = escapeDrawText(input.productName.slice(0, 30));

    const args = [
      "-y",
      "-loop", "1", "-t", "5.5", "-i", sceneA,
      "-loop", "1", "-t", "5.5", "-i", sceneB,
      // Scene A: slow zoom for motion, then crossfade into B.
      "-filter_complex",
      [
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,zoompan=z='min(zoom+0.0008,1.12)':d=150:s=1080x1920:fps=30[a]",
        "[1:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30[b]",
        "[a][b]xfade=transition=fade:duration=0.8:offset=4.7[v0]",
        // Banner: semi-transparent dark band across the bottom third.
        "[v0]drawbox=y=ih-430:width=iw:height=430:color=0x1c0d05@0.72:t=fill[box]",
        // Primary price line (large), secondary CTA line, brand line.
        `[box]drawtext=text='${primary}':fontcolor=white:fontsize=64:borderw=3:bordercolor=0x1c0d05@0.9:x=(w-text_w)/2:y=h-360[txt1]`,
        `[txt1]drawtext=text='${secondary}':fontcolor=0xf6e9d7:fontsize=38:borderw=2:bordercolor=0x1c0d05@0.9:x=(w-text_w)/2:y=h-260[txt2]`,
        `[txt2]drawtext=text='${brand}':fontcolor=0xd9ae76:fontsize=34:borderw=2:bordercolor=0x1c0d05@0.9:x=(w-text_w)/2:y=h-180[vout]`,
      ].join(";"),
      "-map", "[vout]",
      "-t", "10",
      "-r", "30",
      "-c:v", "libx264",
      "-profile:v", "baseline",
      "-level", "3.1",
      "-pix_fmt", "yuv420p",
      "-preset", "veryfast",
      "-crf", "23",
      "-movflags", "+faststart",
      out,
    ];

    await runFfmpeg(args);
    const mp4 = await readFile(out);
    if (mp4.length < 50_000) throw new Error("Reel render produced a suspiciously small file");
    return { mp4, engine: "ffmpeg", durationSec: 10 };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Tiny non-playable MP4 placeholder (tests only — keeps interfaces honest). */
export async function renderReelMock(): Promise<ReelResult> {
  const header = Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
  ]);
  return { mp4: Buffer.concat([header, Buffer.alloc(64 * 1024)]), engine: "ffmpeg", durationSec: 10 };
}
