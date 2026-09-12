/**
 * E2E smoke test — the REAL engine flow on the demo store (no network):
 *
 *   social: generate → approve → publish (TEST MODE ids)
 *   ad:     generate → approve+stage (PAUSED, TEST ids) → activate (2nd)
 *           → state machine + idempotency assertions
 *
 * Runs with Supabase env cleared so isSupabaseBackend() is false → demo mode.
 * Ollama is not running in CI — the engines fall back to the deterministic
 * template, which is exactly what the "engine" field records.
 *
 * The branded post-card composition runs FOR REAL here: the seeded product
 * image is a tiny sharp-generated JPEG written into the gitignored demo
 * uploads dir (served via /api/media), so sharp + SVG + storage all execute.
 */
import { mkdtempSync, mkdirSync, writeFileSync, statSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

const SAVED_ENV: Record<string, string | undefined> = {};
const CLEAR = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_USE_SUPABASE",
  "OLLAMA_ENABLE",
  "OLLAMA_TEXT_MODEL",
  "OLLAMA_BASE_URL",
  "SOCIAL_TEST_MODE",
  "ADS_TEST_MODE",
  "TELEGRAM_BOT_TOKEN",
  "TELEGRAM_CHAT_ID",
  "MARKETING_AI_DEMO_PATH",
  "POLLINATIONS_API_KEY",
];

/** Throwaway marketing-ai.json per test FILE (module-level consts are cached). */
const tmpDir = mkdtempSync(path.join(os.tmpdir(), "thetanti-ai-smoke-"));
process.env.MARKETING_AI_DEMO_PATH = path.join(tmpDir, "marketing-ai.json");

/**
 * The demo uploads dir is cwd-relative (gitignored) — a throwaway PNG/JPEG is
 * seeded per test run so the card composer has real bytes to work with.
 */
const demoUploads = path.join(process.cwd(), ".demo-data", "uploads");

/** Card file written by the composer during this run (cleaned up after). */
let createdCard: string | null = null;

function cardExists(p: string): boolean {
  try {
    return statSync(p).size > 1000; // real JPEG, not an empty stub
  } catch {
    return false;
  }
}

beforeEach(() => {
  for (const k of CLEAR) {
    SAVED_ENV[k] = process.env[k];
    delete process.env[k];
  }
  process.env.MARKETING_AI_DEMO_PATH = path.join(tmpDir, "marketing-ai.json");
});

afterAll(() => {
  for (const [k, v] of Object.entries(SAVED_ENV)) {
    if (v !== undefined) process.env[k] = v;
    else delete process.env[k];
  }
  try {
    rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  // Remove the seeded photo + the composed card from the gitignored uploads.
  try {
    rmSync(path.join(demoUploads, "smoke-ai-saree.jpg"), { force: true });
  } catch {
    /* best effort */
  }
  if (createdCard) {
    try {
      rmSync(createdCard, { force: true });
    } catch {
      /* best effort */
    }
  }
});

const SLUG = "smoke-ai-saree";

async function seedProduct(): Promise<void> {
  // Real JPEG bytes in the demo uploads dir — the card composer fetches and
  // recomposes them (sharp). Served to the engine as /api/media/<file>.
  mkdirSync(demoUploads, { recursive: true });
  const photo = await sharp({
    create: { width: 80, height: 100, channels: 3, background: { r: 92, g: 53, b: 14 } },
  })
    .jpeg()
    .toBuffer();
  writeFileSync(path.join(demoUploads, "smoke-ai-saree.jpg"), photo);
  const db = await import("@/lib/demo/db");
  await db.upsertProduct({
    slug: SLUG,
    name: "Smoke Test Saree",
    category: "cotton-sarees",
    fabric: "soft cotton",
    price: 199,
    images: ["/api/media/smoke-ai-saree.jpg"],
  } as Parameters<typeof db.upsertProduct>[0]);
}

describe("marketing AI end-to-end (demo + TEST MODE)", () => {
  it("social: generate → approve → publish, idempotent retries", async () => {
    await seedProduct();
    const { generateSocialPost, approveSocialPost, publishSocialPost } = await import(
      "@/lib/marketing/social-engine"
    );
    const { listSocialPosts } = await import("@/lib/marketing/ai-store");

    const gen1 = await generateSocialPost({ productSlug: SLUG, kind: "product_feature", language: "hinglish" });
    expect(gen1.created).toBe(true);
    expect(gen1.post.state).toBe("pending_approval");
    expect(gen1.post.engine).toBe("template-fallback"); // no Ollama in CI
    expect(gen1.post.imageUrl).toContain("/api/media/smoke-ai-saree.jpg");

    // Branded card was composed for real (sharp + SVG + storage).
    expect(gen1.post.postImageUrl).toMatch(/^\/api\/media\/.+\.jpg$/);
    const cardPath = path.join(demoUploads, path.basename(gen1.post.postImageUrl!));
    createdCard = cardPath;
    expect(cardExists(cardPath)).toBe(true);
    const cardMeta = await sharp(cardPath).metadata();
    expect(cardMeta.width).toBe(1080);
    expect(cardMeta.height).toBe(1350);

    // Idempotent: a second generate reuses the record.
    const gen2 = await generateSocialPost({ productSlug: SLUG, kind: "product_feature", language: "hinglish" });
    expect(gen2.created).toBe(false);
    expect(gen2.post.id).toBe(gen1.post.id);

    // Publishing before approval is refused.
    await expect(publishSocialPost(gen1.post.id, "admin")).rejects.toThrow(/approved/);

    const approved = await approveSocialPost(gen1.post.id, "admin");
    expect(approved.state).toBe("approved");

    const pub = await publishSocialPost(gen1.post.id, "admin");
    expect(pub.simulated).toBe(true);
    expect(pub.post.state).toBe("published");
    expect(pub.post.fbPostId).toMatch(/^TEST-FB-/);
    expect(pub.post.igMediaId).toMatch(/^TEST-IG-/);
    expect(pub.note).toMatch(/TEST MODE/);

    // Idempotent: publishing again changes nothing.
    const again = await publishSocialPost(gen1.post.id, "admin");
    expect(again.post.fbPostId).toBe(pub.post.fbPostId);
    expect(again.note).toMatch(/idempotent/i);

    const posts = await listSocialPosts();
    expect(posts.find((p) => p.productSlug === SLUG)?.state).toBe("published");
  }, 30_000);

  it("ai_model_ad: I2I skipped without key → raw-image post still flows", async () => {
    await seedProduct();
    const { generateSocialPost, approveSocialPost, publishSocialPost } = await import(
      "@/lib/marketing/social-engine"
    );
    const { aiModelAdPrompt } = await import("@/lib/marketing/pollinations");

    // The prompt builder spells the price INR — never the garble-prone ₹ glyph.
    const prompt = aiModelAdPrompt({ price: 199 });
    expect(prompt).toContain("INR 199");
    expect(prompt).not.toContain("₹");

    // No Pollinations key in this env → the I2I edit is skipped gracefully,
    // but the editorial card is STILL composed from the raw product photo
    // (typography pass works without the cloud).
    const gen = await generateSocialPost({ productSlug: SLUG, kind: "ai_model_ad", language: "hinglish" });
    expect(gen.created).toBe(true);
    expect(gen.post.state).toBe("pending_approval");
    expect(gen.post.kind).toBe("ai_model_ad");
    expect(gen.post.engine).toBe("pollinations-off+template-fallback");
    expect(gen.post.postImageUrl).toMatch(/^\/api\/media\/.+-editorial-.+\.jpg$/);
    expect(gen.post.imageUrl).toContain("/api/media/smoke-ai-saree.jpg");

    // The editorial card is a real 1080×1350 JPEG on disk.
    const editorialPath = path.join(demoUploads, path.basename(gen.post.postImageUrl!));
    const editorialMeta = await sharp(editorialPath).metadata();
    expect(editorialMeta.width).toBe(1080);
    expect(editorialMeta.height).toBe(1350);

    // Idempotent key reuse.
    const gen2 = await generateSocialPost({ productSlug: SLUG, kind: "ai_model_ad", language: "hinglish" });
    expect(gen2.created).toBe(false);
    expect(gen2.post.id).toBe(gen.post.id);

    // Full approval → TEST MODE publish still works for this kind.
    await approveSocialPost(gen.post.id, "admin");
    const pub = await publishSocialPost(gen.post.id, "admin");
    expect(pub.simulated).toBe(true);
    expect(pub.post.state).toBe("published");
  }, 30_000);

  it("ad: generate → approve+stage PAUSED → activate needs BOTH approvals", async () => {
    await seedProduct();
    const { generateAd, approveAd, stageAd, activateAd, pauseAd } = await import(
      "@/lib/marketing/ads-engine"
    );
    const { getAdByKey } = await import("@/lib/marketing/ai-store");
    const { adKey } = await import("@/lib/marketing/ads");

    const gen = await generateAd({
      productSlug: SLUG,
      objective: "OUTCOME_TRAFFIC",
      language: "hinglish",
      dailyBudgetInr: 100,
    });
    expect(gen.created).toBe(true);
    expect(gen.ad.state).toBe("pending_approval");

    // The money switch refuses everything that has not been staged PAUSED.
    await expect(activateAd(gen.ad.id, "admin")).rejects.toThrow(/PAUSED ad awaiting activation/);

    const approved = await approveAd(gen.ad.id, "admin");
    expect(approved.state).toBe("approved");
    expect(approved.firstApprovedAt).toBeTruthy();

    const staged = await stageAd(ad0(approved.id));
    expect(staged.simulated).toBe(true);
    expect(staged.ad.state).toBe("pending_activation");
    expect(staged.ad.metaCampaignId).toMatch(/^TEST-CAMP-/);
    expect(staged.ad.metaAdsetId).toMatch(/^TEST-ADSET-/);
    expect(staged.ad.metaCreativeId).toMatch(/^TEST-CREATIVE-/);
    expect(staged.ad.metaAdId).toMatch(/^TEST-AD-/);
    expect(staged.ad.metaStatus).toBe("PAUSED");

    // Re-staging must NOT duplicate Meta objects (Rule 11).
    const restaged = await stageAd(approved.id);
    expect(restaged.ad.metaCampaignId).toBe(staged.ad.metaCampaignId);
    expect(restaged.ad.metaAdId).toBe(staged.ad.metaAdId);

    // Activation = the SECOND approval.
    const active = await activateAd(approved.id, "admin");
    expect(active.state).toBe("active");
    expect(active.secondApprovedAt).toBeTruthy();
    expect(active.metaStatus).toBe("ACTIVE");

    // Owner can still pause.
    const paused = await pauseAd(approved.id);
    expect(paused.state).toBe("paused");
    expect(paused.metaStatus).toBe("PAUSED");

    // Key-based idempotency check on the store.
    const stored = await getAdByKey(adKey(SLUG, "OUTCOME_TRAFFIC", "hinglish"));
    expect(stored?.id).toBe(gen.ad.id);
  }, 30_000);

  it("social: reject keeps rejected records reusable for regeneration", async () => {
    const { generateSocialPost, rejectSocialPost, regenerateSocialPost } = await import(
      "@/lib/marketing/social-engine"
    );
    const gen = await generateSocialPost({ productSlug: SLUG, kind: "styling_tip", language: "banglish" });
    expect(gen.created).toBe(true);
    const rejected = await rejectSocialPost(gen.post.id, "Not on brand", "admin");
    expect(rejected.state).toBe("rejected");
    expect(rejected.rejectedReason).toBe("Not on brand");
    const regen = await regenerateSocialPost(gen.post.id);
    expect(regen.id).toBe(gen.post.id);
    expect(regen.state).toBe("pending_approval");
  }, 30_000);
});

/** stageAd expects an id; keep the helper trivially explicit for readability. */
function ad0(id: string): string {
  return id;
}
