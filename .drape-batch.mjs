/**
 * Batch Cloudflare drape processor for TheTanti draft sarees.
 *
 * For every draft product that has no model drape renders yet, this calls the
 * existing resumable admin endpoint (POST /api/admin/products/generate-photos
 * with engine=cloudflare) repeatedly until all poses are done — exactly what
 * the admin editor's "Generate model photos" loop does, just unattended.
 *
 * Output: progress lines to stdout, per-product detail to .drape-batch.log.
 * Usage: node .drape-batch.mjs [limit] [--partials]
 *   --partials  process drafts that have SOME renders but not all 4 poses
 *               (cleanup pass after an interrupted main batch).
 */
import { readFileSync, appendFileSync, writeFileSync } from "node:fs";

const ORIGIN = "http://localhost:3000";
const COOKIE_FILE = ".admin-cookie.txt";
const LOG = ".drape-batch.log";
/** Supabase rotates the auth token; keep whatever the API sends back. */
const REFRESH_COOKIE = process.env.SB_REFRESH_COOKIE !== "0";
const MAX_ATTEMPTS_PER_PRODUCT = 6; // 4 poses are 1-2 calls normally; 6 = generous retry ceiling
const INACTIVITY_TIMEOUT_MS = 8 * 60_000; // stop a product if nothing lands for 8 min
const BETWEEN_CALLS_MS = 2_000;

let cookie = readFileSync(COOKIE_FILE, "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => l.trim().split(/\t/))
  .filter((parts) => parts.length >= 7)
  .map((parts) => `${parts[5]}=${parts[6]}`)
  .pop();
if (!cookie) {
  console.error("No ambika_session cookie in .admin-cookie.txt — log in first");
  process.exit(1);
}

const limitArg = Number(process.argv[2] ?? "") || Infinity;
const partialsMode = process.argv.includes("--partials");
/**
 * --refix: force-regenerate products whose renders were made BEFORE the
 * extra-hands prompt fix (Cloudflare renders only, any count, draft status).
 * Uses force=true to wipe previous renders first, then regenerates all 4 poses.
 */
const refixMode = process.argv.includes("--refix");
const REFIX_CUTOFF_MS = 1790143300000; // when the fixed prompt went live (ms epoch)
const log = (line) => {
  appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
};

/**
 * Re-login when the stored admin token expires (Supabase access tokens live
 * ~1 hour; a multi-hour batch outlives it). Credentials come from the local
 * secrets file; the refreshed cookie is written back to COOKIE_FILE so manual
 * probes keep working too.
 */
async function loginAsAdmin() {
  try {
    const creds = readFileSync("secret/secret/admin.txt", "utf8");
    const email = /^email:\s*(.+)$/m.exec(creds)?.[1]?.trim();
    const password = /^password:\s*(.+)$/m.exec(creds)?.[1]?.trim();
    if (!email || !password) return false;
    const res = await fetch(`${ORIGIN}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    absorbCookies(res);
    if (!res.ok) return false;
    const token = cookie
      .split(/;\s*/)
      .find((c) => c.includes("auth-token"));
    if (token) {
      const eq = token.indexOf("=");
      writeFileSync(
        COOKIE_FILE,
        `# Netscape HTTP Cookie File\nlocalhost\tFALSE\t/\tFALSE\t1893456000\t${token.slice(0, eq)}\t${token.slice(eq + 1)}\n`,
      );
    }
    log("    re-logged in as admin (token refresh)");
    return true;
  } catch {
    return false;
  }
}

async function api(path, init = {}, retried = false) {
  const res = await fetch(`${ORIGIN}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", Cookie: cookie, ...(init.headers ?? {}) },
  });
  absorbCookies(res);
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { ok: false, error: text.slice(0, 200) };
  }
  // Token expired mid-batch → refresh once and retry the same request.
  if ((res.status === 401 || body.error === "Not authorised") && !retried) {
    if (await loginAsAdmin()) return api(path, init, true);
  }
  return { status: res.status, body };
}

function productTitle(p) {
  return p.name || p.slug;
}

/** Merge any Set-Cookie updates so the admin session never lapses mid-batch. */
function absorbCookies(res) {
  if (!REFRESH_COOKIE) return;
  const setCookies = res.headers.getSetCookie?.() ?? [];
  for (const raw of setCookies) {
    const pair = raw.split(";", 1)[0];
    const name = pair.slice(0, pair.indexOf("=")).trim();
    if (!name) continue;
    const re = new RegExp(`(^|;\\s*)${name}=[^;]*`);
    if (re.test(cookie)) {
      cookie = cookie.replace(re, `$1${pair}`);
    } else {
      cookie = `${cookie}; ${pair}`;
    }
  }
}

function garmentUrlOf(p) {
  const renders = new Set(
    (p.marketing?.tryOn?.renders ?? []).map((r) => r.imageUrl).concat(p.marketing?.tryOn?.imageUrl ?? []),
  );
  return p.images?.find((u) => !renders.has(u));
}

console.log(`Fetching products…`);
const { body } = await api("/api/admin/products");
const eligible = (body.products ?? []).filter(
  (p) =>
    p.dbStatus === "draft" &&
    (p.images?.length ?? 0) > 0 &&
    (refixMode
      ? (p.marketing?.tryOn?.renders ?? []).some(
          (r) =>
            (r.provider ?? "").startsWith("cloudflare:") &&
            Number(String(r.imageUrl).match(/(\d{13})-/)?.[1] ?? 0) < REFIX_CUTOFF_MS,
        )
      : partialsMode
        ? (p.marketing?.tryOn?.renders?.length ?? 0) > 0 &&
          (p.marketing?.tryOn?.renders?.length ?? 0) < 4
        : (p.marketing?.tryOn?.renders?.length ?? 0) === 0),
);
const batch = eligible.slice(0, limitArg);
console.log(`Draft products to process${refixMode ? " (REFIX: pre-fix renders)" : partialsMode ? " (PARTIALS)" : ""}: ${batch.length} (of ${eligible.length} eligible)`);
log(`=== batch start: ${batch.length} products ===`);

let okCount = 0, partialCount = 0, failCount = 0;
let processed = 0;
let quotaAborted = false;

for (const p of batch) {
  processed += 1;
  const slug = p.slug;
  const title = productTitle(p);
  const garment = garmentUrlOf(p);
  const prefix = `[${processed}/${batch.length}]`;
  console.log(`${prefix} ${slug}`);
  log(`--- ${slug} (${title})`);

  const started = Date.now();
  let lastLandedAt = Date.now();
  let attempts = 0;
  let lastError;
  let rendered = 0;
  let remaining;

  while (attempts < MAX_ATTEMPTS_PER_PRODUCT) {
    if (Date.now() - lastLandedAt > INACTIVITY_TIMEOUT_MS) {
      lastError = "stalled: no new image for 8 minutes";
      break;
    }
    attempts += 1;
    let r;
    try {
      r = await api("/api/admin/products/generate-photos", {
        method: "POST",
        body: JSON.stringify({
          slug,
          name: title,
          garmentUrl: garment,
          engine: "cloudflare",
          force: refixMode,
        }),
      });
    } catch (err) {
      lastError = `network: ${err.message}`;
      await new Promise((s) => setTimeout(s, 10_000));
      continue;
    }
    if (r.body?.ok) {
      if ((r.body.urls ?? []).length > 0) {
        rendered += r.body.urls.length;
        lastLandedAt = Date.now();
      }
      remaining = r.body.remaining ?? [];
      if (r.body.pending) {
        await new Promise((s) => setTimeout(s, 15_000)); // async provider — poll again
        continue;
      }
      if (remaining.length === 0) break;
    } else {
      lastError = r.body?.error ?? `HTTP ${r.status}`;
      log(`    attempt ${attempts} failed: ${lastError}`);
      // Hard failure of the whole pipeline? stop early.
      if (/worker is not configured|Upload a saree photo|No saree models/i.test(lastError)) break;
      // Quota exhausted → every remaining product would fail too. Abort batch.
      if (/allocation|quota|429/i.test(lastError)) {
        quotaAborted = true;
        break;
      }
      await new Promise((s) => setTimeout(s, 5_000));
    }
  }

  if (remaining?.length === 0) {
    okCount += 1;
    log(`    DONE: ${rendered} renders in ${Math.round((Date.now() - started) / 1000)}s${refixMode ? " (refix)" : ""}`);
    console.log(`${prefix}   ✓ complete — ${rendered} renders`);
  } else if (rendered > 0) {
    partialCount += 1;
    log(`    PARTIAL: ${rendered} renders, remaining=${JSON.stringify(remaining)}, lastError=${lastError ?? "-"}`);
    console.log(`${prefix}   ◐ partial — ${rendered} renders, ${remaining?.length ?? "?"} poses missing (${lastError ?? "retry later"})`);
  } else {
    failCount += 1;
    log(`    FAILED: ${lastError ?? "no renders"}`);
    console.log(`${prefix}   ✗ failed — ${lastError ?? "no renders"}`);
  }

  await new Promise((s) => setTimeout(s, BETWEEN_CALLS_MS));
  if (quotaAborted) break;
}

if (quotaAborted) {
  console.log(`\nBatch ABORTED after ${processed} products: Workers AI daily free allocation reached. Retry after the daily reset.`);
}
console.log(`\nBatch complete: ${okCount} complete, ${partialCount} partial, ${failCount} failed (of ${processed})`);
log(`=== batch end: ${okCount} complete / ${partialCount} partial / ${failCount} failed ===`);
