import { beforeEach, describe, expect, it } from "vitest";
import {
  canTransitionSocial,
  fallbackSocialCaption,
  parseSocialReply,
  pickSocialImage,
  socialKey,
  socialToCaption,
  SOCIAL_KINDS,
  type SocialPromptInput,
} from "@/lib/marketing/social";
import {
  adKey,
  adUserPrompt,
  buildAdParams,
  buildAdsetParams,
  buildCampaignParams,
  buildCreativeParams,
  canTransitionAd,
  ctaTypeFor,
  dailyBudgetMinorUnits,
  fallbackAdCopy,
  isAdHarmless,
  parseAdReply,
  validateDailyBudget,
} from "@/lib/marketing/ads";
import {
  parseCallback,
  parseTelegramTokenFile,
  socialCallback,
  adCallback,
} from "@/lib/marketing/telegram";
import { ollamaModel, extractJsonObject } from "@/lib/marketing/ollama";

const socialInput = (): SocialPromptInput => ({
  productName: "Jamdani Blue",
  productCategory: "daily-wear",
  price: 199,
  fabric: "soft cotton",
  productUrl: "https://www.thetanti.shop/sarees/jamdani-blue",
  kind: "product_feature",
  language: "hinglish",
});

const validSocialJson = JSON.stringify({
  hook: "Roz ki comfort — ₹199",
  body: "Soft cotton saree, breathable weave, poore din aaram.",
  cta: "Order kariye: https://www.thetanti.shop/sarees/jamdani-blue",
  hashtags: ["#SareeLove", "#DailyWearSaree", "#Saree199", "#TheTanti", "#Handloom", "#SareeStyle"],
});

describe("social post parsing", () => {
  it("parses a valid model reply", () => {
    const caption = parseSocialReply(validSocialJson);
    expect(caption.hook).toBe("Roz ki comfort — ₹199");
    expect(caption.hashtags).toHaveLength(6);
    expect(caption.cta).toContain("/sarees/jamdani-blue");
  });

  it("tolerates markdown fences around the JSON", () => {
    const caption = parseSocialReply("```json\n" + validSocialJson + "\n```");
    expect(caption.hook).toContain("₹199");
  });

  it("rejects replies without hashtags", () => {
    expect(() =>
      parseSocialReply(JSON.stringify({ hook: "h", body: "b", cta: "c", hashtags: [] })),
    ).toThrow();
  });

  it("rejects replies with no JSON at all", () => {
    expect(() => parseSocialReply("sorry, I cannot help with that")).toThrow();
  });

  it("normalises hashtags without # and caps at 6", () => {
    const caption = parseSocialReply(
      JSON.stringify({
        hook: "h",
        body: "b",
        cta: "c",
        hashtags: ["sareelove", "#daily", "#x", "#y", "#z", "#w", "#extra"],
      }),
    );
    expect(caption.hashtags[0]).toBe("#sareelove");
    expect(caption.hashtags).toHaveLength(6);
  });
});

describe("social caption fallback + composer", () => {
  it("keeps the flat price and product URL verbatim", () => {
    const caption = fallbackSocialCaption(socialInput());
    expect(caption.hook).toContain("₹199");
    expect(caption.cta).toContain("https://www.thetanti.shop/sarees/jamdani-blue");
    const full = socialToCaption(caption);
    expect(full).toContain(caption.hook);
    expect(full).toContain("#Saree199");
  });

  it("banglish variant stays warm and URL-faithful", () => {
    const caption = fallbackSocialCaption({ ...socialInput(), language: "banglish" });
    expect(caption.cta).toContain("korun");
    expect(caption.cta).toContain(socialInput().productUrl);
  });
});

describe("social state machine", () => {
  it("follows draft → pending → approved → published", () => {
    expect(canTransitionSocial("draft", "pending_approval")).toBe(true);
    expect(canTransitionSocial("pending_approval", "approved")).toBe(true);
    expect(canTransitionSocial("approved", "published")).toBe(true);
  });

  it("never skips the approval gate", () => {
    expect(canTransitionSocial("draft", "approved")).toBe(false);
    expect(canTransitionSocial("pending_approval", "published")).toBe(false);
    expect(canTransitionSocial("published", "pending_approval")).toBe(false);
    expect(canTransitionSocial("approved", "rejected")).toBe(false);
  });

  it("allows rejection only before approval", () => {
    expect(canTransitionSocial("pending_approval", "rejected")).toBe(true);
    expect(canTransitionSocial("draft", "rejected")).toBe(true);
    expect(canTransitionSocial("approved", "rejected")).toBe(false);
  });
});

describe("social helpers", () => {
  it("keys posts per product+kind+language", () => {
    expect(socialKey("jamdani", "styling_tip", "banglish")).toBe("jamdani:styling_tip:banglish");
    expect(SOCIAL_KINDS).toHaveLength(6);
  });

  it("picks the first non-empty image", () => {
    expect(pickSocialImage(["", "  ", "/api/media/a.jpg"])).toBe("/api/media/a.jpg");
    expect(pickSocialImage([])).toBeUndefined();
  });
});

const adInput = {
  productName: "Tant Red",
  productCategory: "daily-wear",
  price: 199,
  fabric: "cotton",
  productUrl: "https://www.thetanti.shop/sarees/tant-red",
  objective: "OUTCOME_TRAFFIC" as const,
  language: "hinglish" as const,
};

describe("ad copy parsing", () => {
  it("parses a valid ad reply", () => {
    const copy = parseAdReply(
      JSON.stringify({
        headline: "Tant Red — ₹199",
        primaryText: "Soft cotton, poore din aaram. Cash on Delivery.",
        cta: "Order kariye",
        hashtags: ["#Saree199", "#TheTanti", "#DailyWearSaree", "#SareeLove"],
      }),
    );
    expect(copy.headline).toBe("Tant Red — ₹199");
    expect(copy.hashtags).toHaveLength(4);
  });

  it("rejects overlong headlines and missing cta", () => {
    expect(() =>
      parseAdReply(
        JSON.stringify({
          headline: "x".repeat(80),
          primaryText: "p",
          cta: "c",
          hashtags: ["#a", "#b"],
        }),
      ),
    ).toThrow();
    expect(() =>
      parseAdReply(
        JSON.stringify({ headline: "h", primaryText: "p", cta: "", hashtags: ["#a", "#b"] }),
      ),
    ).toThrow();
  });

  it("falls back to honest template copy", () => {
    const copy = fallbackAdCopy(adInput);
    expect(copy.headline).toContain("₹199");
    expect(copy.primaryText).toContain("Cash on Delivery");
  });

  it("mentions the URL verbatim in the prompt", () => {
    expect(adUserPrompt(adInput)).toContain(adInput.productUrl);
  });
});

describe("ad state machine (TWO-approval gate)", () => {
  it("requires staging before activation", () => {
    expect(canTransitionAd("approved", "staged")).toBe(true);
    expect(canTransitionAd("staged", "pending_activation")).toBe(true);
    expect(canTransitionAd("pending_activation", "active")).toBe(true);
  });

  it("never jumps straight to active", () => {
    expect(canTransitionAd("pending_approval", "active")).toBe(false);
    expect(canTransitionAd("approved", "active")).toBe(false);
    expect(canTransitionAd("staged", "active")).toBe(false);
    expect(canTransitionAd("draft", "pending_activation")).toBe(false);
  });

  it("pre-activation states are harmless", () => {
    expect(isAdHarmless("approved")).toBe(true);
    expect(isAdHarmless("pending_activation")).toBe(false);
    expect(isAdHarmless("active")).toBe(false);
  });

  it("keys ads per product+objective+language", () => {
    expect(adKey("tant", "OUTCOME_SALES", "banglish")).toBe("tant:OUTCOME_SALES:banglish");
  });
});

describe("ad budget validation", () => {
  it("accepts whole rupees in range and converts to minor units", () => {
    validateDailyBudget(100);
    expect(dailyBudgetMinorUnits(100)).toBe(10_000);
  });

  it("rejects out-of-range and fractional budgets", () => {
    expect(() => validateDailyBudget(10)).toThrow(/between/);
    expect(() => validateDailyBudget(5000)).toThrow(/between/);
    expect(() => validateDailyBudget(99.5)).toThrow(/whole number/);
  });
});

describe("Meta payload builders", () => {
  it("creates campaigns and ads PAUSED", () => {
    expect(buildCampaignParams("n", "OUTCOME_TRAFFIC").status).toBe("PAUSED");
    expect(buildAdParams("n", "set1", "cre1").status).toBe("PAUSED");
  });

  it("encodes adset targeting and budget", () => {
    const params = buildAdsetParams({
      name: "n",
      campaignId: "camp1",
      dailyBudgetMinor: 10_000,
      country: "IN",
      ageMin: 30,
      ageMax: 55,
    });
    expect(params.campaign_id).toBe("camp1");
    expect(params.daily_budget).toBe("10000");
    const targeting = JSON.parse(params.targeting) as { geo_locations: { countries: string[] }; age_min: number };
    expect(targeting.geo_locations.countries).toEqual(["IN"]);
    expect(targeting.age_min).toBe(30);
  });

  it("builds a single-image creative with the public URL and CTA type", () => {
    const params = buildCreativeParams(
      "n",
      "page1",
      "https://cdn.example/img.jpg",
      { headline: "h", primaryText: "p", cta: "c", hashtags: ["#a", "#b"] },
      "https://www.thetanti.shop/sarees/x",
      "SHOP_NOW",
    );
    const spec = JSON.parse(params.object_story_spec) as {
      page_id: string;
      link_data: { picture: string; link: string; message: string };
    };
    expect(spec.page_id).toBe("page1");
    expect(spec.link_data.picture).toBe("https://cdn.example/img.jpg");
    expect(spec.link_data.message).toContain("#a");
    expect(ctaTypeFor("whatsapp")).toBe("WHATSAPP_MESSAGE");
    expect(ctaTypeFor("website")).toBe("SHOP_NOW");
  });
});

describe("telegram token file parsing", () => {
  it("parses a bare bot token", () => {
    const out = parseTelegramTokenFile("123456789:AAExampleTokenValue_1234567890");
    expect(out.botToken).toBe("123456789:AAExampleTokenValue_1234567890");
    expect(out.chatId).toBeUndefined();
  });

  it("parses token/chat key-value lines", () => {
    const out = parseTelegramTokenFile("token: 111:aaa\nchat_id: -100123");
    expect(out.botToken).toBe("111:aaa");
    expect(out.chatId).toBe("-100123");
  });

  it("parses JSON payloads", () => {
    const out = parseTelegramTokenFile('{"botToken":"111:bbb","chatId":"42"}');
    expect(out.botToken).toBe("111:bbb");
    expect(out.chatId).toBe("42");
  });

  it("returns nothing for garbage", () => {
    expect(parseTelegramTokenFile("hello world")).toEqual({});
    expect(parseTelegramTokenFile("")).toEqual({});
  });
});

describe("telegram callback routing", () => {
  it("round-trips social and ad callbacks", () => {
    expect(parseCallback(socialCallback("approve", "sp_1"))).toEqual({
      kind: "social",
      action: "approve",
      id: "sp_1",
    });
    expect(parseCallback(adCallback("activate", "ad_9"))).toEqual({
      kind: "ad",
      action: "activate",
      id: "ad_9",
    });
    expect(parseCallback("bogus")).toEqual({ kind: "unknown", action: "", id: "" });
  });

  it("defaults to the qwen2.5:7b local model", () => {
    const prev = process.env.OLLAMA_TEXT_MODEL;
    delete process.env.OLLAMA_TEXT_MODEL;
    expect(ollamaModel()).toBe("qwen2.5:7b");
    if (prev !== undefined) process.env.OLLAMA_TEXT_MODEL = prev;
  });

  it("extracts the first JSON object from mixed prose", () => {
    expect(extractJsonObject('sure! {"a":1} hope that helps')).toEqual({ a: 1 });
  });
});

describe("test mode defaults", () => {
  const origSocial = process.env.SOCIAL_TEST_MODE;
  const origAds = process.env.ADS_TEST_MODE;
  beforeEach(() => {
    delete process.env.SOCIAL_TEST_MODE;
    delete process.env.ADS_TEST_MODE;
  });

  it("defaults to TEST MODE so nothing can publish or spend on a fresh install", async () => {
    const { isSocialTestMode } = await import("@/lib/marketing/social");
    const { isAdsTestMode } = await import("@/lib/marketing/ads");
    expect(isSocialTestMode()).toBe(true);
    expect(isAdsTestMode()).toBe(true);
    process.env.SOCIAL_TEST_MODE = origSocial;
    process.env.ADS_TEST_MODE = origAds;
  });
});
