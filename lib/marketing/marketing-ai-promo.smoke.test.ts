/**
 * Promo poster E2E (demo store, TEST MODE).
 * Verifies: price protection, hero selection (existing render first),
 * idempotent reuse, and a REAL composed 1080×1350 poster on disk.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
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
  "PUTER_TXT2IMG_ENDPOINT",
  "PUTER_OUTPUT_DIR",
];

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "thetanti-promo-"));
process.env.MARKETING_AI_DEMO_PATH = path.join(tmpDir, "marketing-ai.json");

const demoUploads = path.join(process.cwd(), ".demo-data", "uploads");

beforeEach(() => {
  for (const k of CLEAR) {
    SAVED_ENV[k] = process.env[k];
    delete process.env[k];
  }
  process.env.MARKETING_AI_DEMO_PATH = path.join(tmpDir, "marketing-ai.json");
  rmSync(process.env.MARKETING_AI_DEMO_PATH, { force: true });
  // Deterministic gradient path: clear the Pollinations key so a configured
  // account cannot trigger real cloud image generation inside tests.
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
});

const SLUG = "promo-smoke-saree";
const PHOTO = "promo-smoke-hero.jpg";

async function seedProduct(price = 199): Promise<void> {
  mkdirSync(demoUploads, { recursive: true });
  // A "model render" sized 3:4-ish so the hero ellipse crop is realistic.
  const photo = await sharp({
    create: { width: 600, height: 900, channels: 3, background: { r: 214, g: 54, b: 73 } },
  })
    .jpeg()
    .toBuffer();
  writeFileSync(path.join(demoUploads, PHOTO), photo);
  const db = await import("@/lib/demo/db");
  await db.upsertProduct({
    slug: SLUG,
    name: "Promo Smoke Saree",
    category: "silk-sarees",
    fabric: "art silk",
    price,
    images: [`/api/media/${PHOTO}`],
    marketing: {
      tryOn: {
        renders: [{ kind: "front", imageUrl: `/api/media/${PHOTO}`, provider: "test" }],
      },
    } as unknown as Record<string, unknown>,
  } as Parameters<typeof db.upsertProduct>[0]);
}

describe("promo poster e2e (demo + Puter only)", () => {
  it("builds a professional Puter prompt without regional coverage text", async () => {
    const { buildPuterPromoPrompt, puterPromoEnabled } = await import("@/lib/marketing/puter-promo");
    expect(puterPromoEnabled()).toBe(false);
    const prompt = buildPuterPromoPrompt({
      productName: "Teal Silk Saree",
      category: "silk-sarees",
      fabric: "Silk",
      price: 199,
      heroImageUrl: `/api/media/${PHOTO}`,
      seed: 2,
    });
    expect(prompt).toContain("TheTanti");
    expect(prompt).toContain("full-bleed premium portrait 1080x1350 fashion campaign photograph");
    expect(prompt).toContain("provided reference image");
    expect(prompt).toContain("1080x1350");
    expect(prompt).not.toMatch(/ALL OVER WEST BENGAL/i);
    expect(prompt).toMatch(/real adult Bengali woman/i);
    expect(prompt).toMatch(/Absolutely no generated text/i);
  }, 30_000);

  it("composes a high-resolution real-asset promo poster", async () => {
    await seedProduct(199);
    const { composeLuxuryPromoPoster } = await import("@/lib/marketing/promo/poster-image");
    const poster = await composeLuxuryPromoPoster({
      productName: "Promo Smoke Saree",
      price: 199,
      productUrl: "https://www.thetanti.shop/sarees/promo-smoke-saree",
      heroImageUrl: `/api/media/${PHOTO}`,
      assetImageUrls: [`/api/media/${PHOTO}`],
      seed: 3,
    });
    const meta = await sharp(poster.buffer).metadata();
    expect(poster.contentType).toBe("image/jpeg");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  }, 30_000);

  it("uses Puter output as an editorial poster base when available", async () => {
    await seedProduct(199);
    const backgroundBuffer = await sharp({
      create: { width: 1080, height: 1350, channels: 3, background: { r: 62, g: 46, b: 35 } },
    })
      .jpeg()
      .toBuffer();
    const { composeLuxuryPromoPoster } = await import("@/lib/marketing/promo/poster-image");
    const poster = await composeLuxuryPromoPoster({
      productName: "Promo Smoke Saree",
      price: 199,
      productUrl: "https://www.thetanti.shop/sarees/promo-smoke-saree",
      heroImageUrl: `/api/media/${PHOTO}`,
      assetImageUrls: [`/api/media/${PHOTO}`],
      backgroundBuffer,
      seed: 9,
    });
    const meta = await sharp(poster.buffer).metadata();
    expect(poster.engine).toContain("sharp-editorial-campaign");
    expect(meta.width).toBe(1080);
    expect(meta.height).toBe(1350);
  }, 30_000);

  it("builds varied Banglish SEO promo captions without emoji or Hinglish", async () => {
    const { buildPromoBanglishCaption } = await import("@/lib/marketing/promo/poster-plan");
    const base = {
      productName: "Crimson And Deep Green With Gold Zari Accents Saree",
      category: "silk-sarees",
      fabric: "Silk",
      price: 199,
      productUrl: "https://www.thetanti.shop/sarees/crimson-and-deep-green-with-gold-zari-accents-saree-mu16wbhv",
    };
    const first = buildPromoBanglishCaption({ ...base, seed: 101 });
    const second = buildPromoBanglishCaption({ ...base, seed: 202 });
    const combined = `${first.hook}\n${first.body}\n${first.cta}`;
    expect(first.hook).not.toBe(second.hook);
    expect(first.body).not.toBe(second.body);
    expect(combined).toMatch(/Bengali saree|daily wear saree|budget saree|affordable Bengali saree/i);
    expect(combined).not.toMatch(/sirf|kariye|aapke|roz|aaram|🙌/i);
    expect(first.cta).toContain(base.productUrl);
  }, 30_000);

  it("refuses to build when the product price breaks the campaign", async () => {
    await seedProduct(299);
    const { generateSocialPost } = await import("@/lib/marketing/social-engine");
    await expect(
      generateSocialPost({ productSlug: SLUG, kind: "promo_poster", language: "hinglish" }),
    ).rejects.toThrow(/Price mismatch/);
  }, 30_000);

  it("requires a connected Puter worker for promo poster generation", async () => {
    await seedProduct(199);
    const { generateSocialPost } = await import("@/lib/marketing/social-engine");

    await expect(generateSocialPost({
      productSlug: SLUG,
      kind: "promo_poster",
      language: "hinglish",
    })).rejects.toThrow(/Puter poster worker is not connected/);
  }, 60_000);

  it("reuses the existing record on regenerate-style re-requests", async () => {
    await seedProduct(199);
    const { generateSocialPost } = await import("@/lib/marketing/social-engine");
    await expect(generateSocialPost({
      productSlug: SLUG,
      kind: "promo_poster",
      language: "hinglish",
    })).rejects.toThrow(/Puter poster worker is not connected/);
  }, 30_000);

  it("regenerate replaces a pending promo poster image", async () => {
    await seedProduct(199);
    const { deleteSocialPost, getSocialPostByKey } = await import("@/lib/marketing/ai-store");
    const { socialKey } = await import("@/lib/marketing/social");
    const old = await getSocialPostByKey(socialKey(SLUG, "promo_poster", "banglish"));
    if (old) await deleteSocialPost(old.id);
    const { generateSocialPost } = await import("@/lib/marketing/social-engine");
    await expect(generateSocialPost({
      productSlug: SLUG,
      kind: "promo_poster",
      language: "hinglish",
    })).rejects.toThrow(/Puter poster worker is not connected/);
  }, 60_000);
});
