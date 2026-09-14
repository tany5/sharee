import { afterEach, describe, expect, it, vi } from "vitest";
import { publishInstagramImage } from "@/lib/marketing/publish";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Instagram publishing", () => {
  it("creates photo containers with explicit IMAGE media type", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init });
        if (String(url).includes("media_publish")) {
          return new Response(JSON.stringify({ id: "ig-post-1" }), { status: 200 });
        }
        if (!init || init.method !== "POST") {
          return new Response(JSON.stringify({ status_code: "FINISHED" }), { status: 200 });
        }
        return new Response(JSON.stringify({ id: "ig-container-1" }), { status: 200 });
      }),
    );

    await expect(
      publishInstagramImage("https://cdn.example.com/poster.jpg", "caption", {
        metaPageToken: "token",
        fbPageId: "fb-page",
        igUserId: "ig-user",
      }),
    ).resolves.toBe("ig-post-1");

    const body = new URLSearchParams(String(calls[0]?.init?.body ?? ""));
    expect(body.get("media_type")).toBe("IMAGE");
    expect(body.get("image_url")).toBe("https://cdn.example.com/poster.jpg");
    expect(body.get("caption")).toBe("caption");
  });
});
