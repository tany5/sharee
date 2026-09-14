/**
 * Unit tests for the image-generation provider layer (no network):
 *   · provider switch via IMAGE_GENERATION_PROVIDER
 *   · cloudflare request shape (URL, auth header, JSON payload)
 *   · normalized success result
 *   · friendly errors: not configured / unavailable / quota / 401
 *   · puter provider without a connected relay
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SAREE_PROMPT,
  generateProductImage,
  providerStatus,
} from "@/lib/ai/image-provider";
import { DEFAULT_CLOUDFLARE_IMAGE_MODEL } from "@/lib/ai/config";

const SAVED: Record<string, string | undefined> = {};

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const baseRequest = {
  sareeImage: TINY_PNG_DATA_URL,
  modelImage: TINY_PNG_DATA_URL,
  aspectRatio: "3:4" as const,
};

function setEnv(patch: Record<string, string | undefined>): void {
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

beforeEach(() => {
  for (const key of [
    "IMAGE_GENERATION_PROVIDER",
    "CLOUDFLARE_IMAGE_WORKER_URL",
    "CLOUDFLARE_IMAGE_WORKER_SECRET",
    "CLOUDFLARE_IMAGE_MODEL",
  ]) {
    SAVED[key] = process.env[key];
    delete process.env[key];
  }
});

afterAll(() => {
  for (const [k, v] of Object.entries(SAVED)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.restoreAllMocks();
});

describe("provider selection", () => {
  it("defaults to puter and reports relay state", () => {
    const status = providerStatus();
    expect(status.provider).toBe("puter");
    expect(status.cloudflareConfigured).toBe(false);
    expect(typeof status.puterRelayConnected).toBe("boolean");
  });

  it("switches to cloudflare via env only", () => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare", CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787" });
    expect(providerStatus().provider).toBe("cloudflare");
    expect(providerStatus().model).toBe(DEFAULT_CLOUDFLARE_IMAGE_MODEL);
  });

  it("uses the configured model name", () => {
    setEnv({
      IMAGE_GENERATION_PROVIDER: "cloudflare",
      CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787",
      CLOUDFLARE_IMAGE_MODEL: "@cf/black-forest-labs/flux-2-klein-9b",
    });
    expect(providerStatus().model).toBe("@cf/black-forest-labs/flux-2-klein-9b");
  });
});

describe("cloudflare provider", () => {
  it("fails with a friendly message when the worker URL is not configured", async () => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare" });
    const result = await generateProductImage(baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain("CLOUDFLARE_IMAGE_WORKER_URL");
  });

  it("sends the documented payload: prompt + references + dimensions + bearer secret", async () => {
    setEnv({
      IMAGE_GENERATION_PROVIDER: "cloudflare",
      CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787",
      CLOUDFLARE_IMAGE_WORKER_SECRET: "test-secret",
      CLOUDFLARE_IMAGE_MODEL: "@cf/black-forest-labs/flux-2-klein-4b",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ success: true, provider: "cloudflare", model: DEFAULT_CLOUDFLARE_IMAGE_MODEL, image: "QUJD", contentType: "image/png" }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateProductImage({ ...baseRequest, prompt: "custom prompt" });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8787/generate");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-secret");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.prompt).toBe("custom prompt");
    expect(String(body.sareeImage)).toMatch(/^data:image\/png;base64,/);
    expect(String(body.modelImage)).toMatch(/^data:image\/png;base64,/);
    expect(body.aspectRatio).toBe("3:4");
    expect(body.poseImage).toBeUndefined();

    expect(result.success).toBe(true);
    expect(result.provider).toBe("cloudflare");
    expect(result.model).toBe(DEFAULT_CLOUDFLARE_IMAGE_MODEL);
    expect(result.imageBase64).toBe("QUJD");
    expect(result.imageUrl).toBe("data:image/png;base64,QUJD");
  });

  it("falls back to the default saree prompt when none is given", async () => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare", CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787" });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: "no image" }), { status: 502 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await generateProductImage(baseRequest);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown[])[1] ? ((fetchMock.mock.calls[0] as [string, RequestInit])[1].body) : ""));
    expect(body.prompt).toBe(DEFAULT_SAREE_PROMPT);
    expect(body.prompt).toContain("source of truth");
    expect(body.prompt).toContain("Do not add text");
  });

  it.each([
    [401, "401/403", "CLOUDFLARE_IMAGE_WORKER_SECRET"],
    [429, "free allocation", "reset"],
    [502, "Workers AI error", "temporarily unavailable"],
  ] as const)("maps HTTP %i to a friendly error", async (status, ...needles) => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare", CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: false }), { status })),
    );
    const result = await generateProductImage(baseRequest);
    expect(result.success).toBe(false);
    for (const needle of needles) expect(result.error).toContain(needle);
  });

  it("reports an unreachable worker without throwing", async () => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare", CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:59999" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const result = await generateProductImage(baseRequest);
    expect(result.success).toBe(false);
    expect(result.error).toContain("unavailable");
    expect(result.error).toContain("wrangler dev");
  });

  it("surfaces worker-reported errors verbatim when friendly ones do not apply", async () => {
    setEnv({ IMAGE_GENERATION_PROVIDER: "cloudflare", CLOUDFLARE_IMAGE_WORKER_URL: "http://localhost:8787" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: "Model returned no image — it may have refused the prompt" }), { status: 502 }),
      ),
    );
    const result = await generateProductImage(baseRequest);
    expect(result.error).toContain("refused the prompt");
  });
});

describe("puter provider", () => {
  it("explains how to connect when no browser relay is signed in", async () => {
    // Clearing the Supabase env keeps the store local; no relay worker exists
    // in the test process, so puterRelayConnected() is false.
    const result = await generateProductImage(baseRequest);
    expect(result.success).toBe(false);
    expect(result.provider).toBe("puter");
    expect(result.error).toContain("Puter browser worker");
    expect(result.error).toContain("sign in");
  });
});
