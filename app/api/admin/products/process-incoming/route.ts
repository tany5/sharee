import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel Hobby caps serverless functions at 300s (this route is local-PC-only
// anyway — the VERCEL guard below refuses to run intake in production).
export const maxDuration = 300;

const DEFAULT_AI_ROOT = "D:/TheTanti-AI";

function requestOrigin(request: Request): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  const host = request.headers.get("host");
  if (!host) return "http://localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

function parseLastJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.lastIndexOf("\n{");
    if (start === -1) return null;
    try {
      return JSON.parse(trimmed.slice(start + 1));
    } catch {
      return null;
    }
  }
}

function runOnce({
  script,
  cookieFile,
  aiRoot,
  origin,
  engine,
}: {
  script: string;
  cookieFile: string;
  aiRoot: string;
  origin: string;
  engine?: string | null;
}): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolve, reject) => {
    const args = [script, "--once", "--cookie-file", cookieFile];
    if (engine) args.push("--engine", engine);
    const child = spawn(
      process.execPath,
      args,
      {
        cwd: path.dirname(script),
        env: {
          ...process.env,
          THETANTI_STORE_ORIGIN: origin,
          THETANTI_AI_ROOT: aiRoot,
        },
        windowsHide: true,
      },
    );
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      resolve({ code: null, stdout, stderr, timedOut: true });
    }, 12 * 60 * 1000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut: false });
    });
  });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  if (process.env.VERCEL) {
    return NextResponse.json(
      { ok: false, error: "Incoming product intake runs only on the local PC with D:/TheTanti-AI." },
      { status: 400 },
    );
  }

  const cookie = request.headers.get("cookie");
  if (!cookie) {
    return NextResponse.json(
      { ok: false, error: "Admin session cookie missing. Open this from the signed-in admin page." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {}; // body is optional
  }

  const aiRoot = process.env.THETANTI_AI_ROOT || DEFAULT_AI_ROOT;
  const script = path.join(aiRoot, "scripts", "watch-incoming-products.mjs");
  if (!existsSync(script)) {
    return NextResponse.json(
      { ok: false, error: `Local intake script not found: ${script}` },
      { status: 400 },
    );
  }

  // Per-run engine choice from the admin buttons: qwen | cloudflare.
  const engineParam = String(body.engine ?? "").trim().toLowerCase();
  const engine = engineParam === "qwen" || engineParam === "cloudflare" ? engineParam : null;

  const tmpDir = path.join(aiRoot, ".tmp");
  const cookieFile = path.join(tmpDir, "admin-cookie-from-ui.txt");
  await mkdir(tmpDir, { recursive: true });
  await writeFile(cookieFile, cookie, "utf8");

  const result = await runOnce({
    script,
    cookieFile,
    aiRoot,
    origin: requestOrigin(request),
    engine,
  });
  const parsed = parseLastJson(result.stdout) ?? parseLastJson(result.stderr);
  if (result.timedOut) {
    return NextResponse.json(
      {
        ok: false,
        error: "Incoming intake timed out. Check D:/TheTanti-AI/logs/folder-intake-*.log for progress.",
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
      },
      { status: 504 },
    );
  }
  if (result.code !== 0) {
    const error =
      parsed && typeof parsed === "object" && "error" in parsed
        ? String((parsed as { error?: unknown }).error)
        : result.stderr.trim() || "Incoming intake failed";
    return NextResponse.json(
      {
        ok: false,
        error,
        result: parsed,
        stdout: result.stdout.slice(-2000),
        stderr: result.stderr.slice(-2000),
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    result: parsed,
    stdout: result.stdout.slice(-2000),
  });
}
