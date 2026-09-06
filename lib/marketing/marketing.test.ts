import { describe, expect, it } from "vitest";
import {
  advancePipeline,
  canAdvance,
  dbStatusFor,
  nextStatus,
  resetForRetry,
} from "@/lib/marketing/status";
import {
  copySystemPrompt,
  copyToCaption,
  fallbackCopy,
  parseCopyReply,
} from "@/lib/marketing/copy";
import { emptyPipeline, parseMarketing, type MarketingData } from "@/lib/marketing/types";
import { pickBaseModel } from "@/lib/marketing/tryon";

const base = (): MarketingData => ({ pipeline: emptyPipeline() });

describe("pipeline status machine", () => {
  it("walks the full happy path", () => {
    let m = base();
    const path = ["tryon_processing", "tryon_completed", "rendering_video", "publishing", "published"] as const;
    for (const to of path) {
      expect(canAdvance(m.pipeline.status)).toBe(true);
      expect(nextStatus(m.pipeline.status)).toBe(to);
      m = advancePipeline(m, to);
    }
    expect(m.pipeline.status).toBe("published");
    expect(m.pipeline.publishedAt).toBeTruthy();
    expect(m.pipeline.attempts).toBe(path.length);
  });

  it("stamps stage timestamps", () => {
    let m = advancePipeline(base(), "tryon_processing");
    expect(m.pipeline.tryOnStartedAt).toBeTruthy();
    m = advancePipeline(m, "tryon_completed");
    expect(m.pipeline.tryOnCompletedAt).toBeTruthy();
    m = advancePipeline(m, "rendering_video");
    expect(m.pipeline.videoStartedAt).toBeTruthy();
  });

  it("rejects illegal transitions", () => {
    expect(() => advancePipeline(base(), "published")).toThrow(/Illegal/);
    // Build a published state legally, then confirm it is terminal.
    let done = advancePipeline(base(), "tryon_processing");
    done = advancePipeline(done, "tryon_completed");
    done = advancePipeline(done, "rendering_video");
    done = advancePipeline(done, "publishing");
    done = advancePipeline(done, "published");
    expect(() => advancePipeline(done, "pending")).toThrow(/Illegal/);
  });

  it("any stage can fail with the error recorded, and retry resets", () => {
    let m = advancePipeline(base(), "tryon_processing");
    m = advancePipeline(m, "failed", { error: "HF space timed out" });
    expect(m.pipeline.status).toBe("failed");
    expect(m.pipeline.error).toBe("HF space timed out");
    expect(m.pipeline.failedAt).toBeTruthy();
    const retried = resetForRetry(m);
    expect(retried.pipeline.status).toBe("pending");
    expect(retried.pipeline.error).toBeUndefined();
  });

  it("merges stage data without dropping previous stages", () => {
    let m = advancePipeline(base(), "tryon_processing");
    m = advancePipeline(m, "tryon_completed", {
      tryOn: { imageUrl: "https://x/render.jpg", provider: "kolors" },
    });
    m = advancePipeline(m, "rendering_video");
    m = advancePipeline(m, "publishing", {
      copy: { headline: "h", bullets: ["a", "b"], cta: "c", hashtags: ["#x"], language: "hinglish" },
      video: { url: "https://x/reel.mp4" },
    });
    expect(m.tryOn?.imageUrl).toBe("https://x/render.jpg");
    expect(m.copy?.headline).toBe("h");
    expect(m.video?.url).toBe("https://x/reel.mp4");
  });

  it("dbStatusFor mirrors statuses for Supabase", () => {
    expect(dbStatusFor("pending")).toBe("draft");
    expect(dbStatusFor("published")).toBe("published");
    expect(dbStatusFor("failed")).toBe("failed");
  });
});

describe("parseMarketing", () => {
  it("parses a stored blob and defaults sanely on garbage", () => {
    const parsed = parseMarketing({
      pipeline: { status: "published", attempts: 3, publishedAt: "2026-01-01T00:00:00Z" },
      tryOn: { imageUrl: "https://x/r.jpg", provider: "kolors" },
      copy: { headline: "Hi", bullets: [], cta: "", hashtags: [] },
    });
    expect(parsed.pipeline.status).toBe("published");
    expect(parsed.pipeline.attempts).toBe(3);
    expect(parsed.tryOn?.provider).toBe("kolors");
    expect(parsed.copy?.headline).toBe("Hi");

    const junk = parseMarketing("not-an-object");
    expect(junk.pipeline.status).toBe("pending");
    expect(junk.copy).toBeUndefined();
  });
});

describe("copy generation", () => {
  const ctx = {
    product: {
      id: "p1",
      slug: "soft-cotton-saree",
      name: "Soft Cotton Saree",
      category: "cotton-sarees",
      fabric: "Pure Cotton",
      price: 199,
      images: [],
    },
    marketing: base(),
    siteUrl: "https://thetanti.in",
  };

  it("parses a clean JSON reply", () => {
    const reply = JSON.stringify({
      headline: "Roz ki comfort, sirf ₹199",
      bullets: ["Soft cotton", "Breathable", "COD available"],
      cta: "Order kariye: https://thetanti.in/sarees/soft-cotton-saree",
      hashtags: ["#SareeLove", "#DailyWear", "#CottonSaree", "#Saree199", "#TheTanti"],
      language: "hinglish",
    });
    const copy = parseCopyReply(reply);
    expect(copy.headline).toContain("₹199");
    expect(copy.bullets).toHaveLength(3);
    expect(copy.hashtags).toHaveLength(5);
  });

  it("parses fenced / noisy model output", () => {
    const reply = '```json\n{"headline":"H","bullets":["a","b"],"cta":"C link","hashtags":["#a","#b","#c"],"language":"banglish"}\n``` extra prose';
    const copy = parseCopyReply(reply);
    expect(copy.headline).toBe("H");
    expect(copy.language).toBe("banglish");
  });

  it("normalises hashtags without #", () => {
    const copy = parseCopyReply(
      '{"headline":"H","bullets":["a","b"],"cta":"C","hashtags":["sareelove","#daily","cottonsaree"],"language":"hinglish"}',
    );
    expect(copy.hashtags[0]).toBe("#sareelove");
    expect(copy.hashtags[2]).toBe("#cottonsaree");
  });

  it("throws on incomplete output", () => {
    expect(() => parseCopyReply('{"headline":"","bullets":[],"cta":"","hashtags":[]}')).toThrow();
    expect(() => parseCopyReply("no json here")).toThrow(/no JSON/);
  });

  it("template fallback keeps the tone + price contract", () => {
    const copy = fallbackCopy(ctx, "hinglish");
    expect(copy.headline).toContain("₹199");
    expect(copy.cta).toContain("https://thetanti.in/sarees/soft-cotton-saree");
    expect(copy.hashtags).toHaveLength(5);
    const caption = copyToCaption(copy);
    expect(caption).toContain("•");
    expect(caption).toContain("#Saree199");
  });

  it("system prompt carries the tone contract", () => {
    expect(copySystemPrompt()).toContain("₹199");
    expect(copySystemPrompt()).toContain("homely");
  });
});

describe("pickBaseModel", () => {
  const models = [
    { id: "a", imageUrl: "https://x/a.jpg" },
    { id: "b", imageUrl: "https://x/b.jpg" },
    { id: "c", imageUrl: "https://x/c.jpg" },
  ];

  it("is deterministic per product id", () => {
    expect(pickBaseModel(models, "product-1")?.id).toBe(pickBaseModel(models, "product-1")?.id);
  });

  it("returns undefined with no models", () => {
    expect(pickBaseModel([], "p")).toBeUndefined();
  });

  it("varies across products", () => {
    const picks = new Set(["p1", "p2", "p3", "p4", "p5", "p6"].map((id) => pickBaseModel(models, id)?.id));
    expect(picks.size).toBeGreaterThan(1);
  });
});
