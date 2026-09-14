/**
 * Unit tests for the meta.txt credential parser (parseMetaFile).
 * Fixtures mirror the owner's file layouts — no real values here.
 */
import { describe, expect, it } from "vitest";
import { parseMetaFile } from "@/lib/marketing/secrets";

describe("parseMetaFile", () => {
  it("parses the NEW layout: new Access Token + FB_PAGE_ID + IG_USER_ID", () => {
    const raw = [
      "App ID = 1234567890",
      "APP Secret = deadbeef",
      "",
      "Access Token= OLDTOKEN",
      "Pageid= 111111111111111",
      "",
      "new Access Token = NEWTOKEN",
      "",
      "FB_PAGE_ID = 222222222222222",
      "IG_USER_ID = 17841400000000000",
    ].join("\n");
    const parsed = parseMetaFile(raw);
    expect(parsed.metaPageToken).toBe("NEWTOKEN"); // newest wins
    expect(parsed.fbPageId).toBe("222222222222222");
    expect(parsed.igUserId).toBe("17841400000000000");
  });

  it("parses the ORIGINAL layout: Access Token + Pageid + JSON block", () => {
    const raw = [
      "Access Token= EAAGoldenToken",
      "Pageid= 111111111111111",
      "",
      "{",
      '  "instagram_business_account": {',
      '    "id": "17841400000000000"',
      "  },",
      '  "id": "111111111111111"',
      "}",
    ].join("\n");
    const parsed = parseMetaFile(raw);
    expect(parsed.metaPageToken).toBe("EAAGoldenToken");
    expect(parsed.fbPageId).toBe("111111111111111");
    expect(parsed.igUserId).toBe("17841400000000000");
  });

  it("tolerates the malformed JSON block that uses '=' instead of ':'", () => {
    const raw = [
      "Access Token= T",
      "Pageid= 111111111111111",
      "{",
      '  "instagram_business_account"= {',
      '    "id"= "17841400000000000"',
      "  },",
      '  "id"= "111111111111111"',
      "}",
    ].join("\n");
    const parsed = parseMetaFile(raw);
    expect(parsed.igUserId).toBe("17841400000000000");
  });

  it("returns empty fields for an unrelated file", () => {
    const parsed = parseMetaFile("hello world\nnothing here");
    expect(parsed.metaPageToken).toBeUndefined();
    expect(parsed.fbPageId).toBeUndefined();
    expect(parsed.igUserId).toBeUndefined();
  });

  it("strips surrounding quotes from values", () => {
    const raw = [
      'new Access Token = "NEWTOKEN"',
      'FB_PAGE_ID = "222222222222222"',
      'IG_USER_ID = "17841400000000000"',
    ].join("\n");
    const parsed = parseMetaFile(raw);
    expect(parsed.metaPageToken).toBe("NEWTOKEN");
    expect(parsed.fbPageId).toBe("222222222222222");
    expect(parsed.igUserId).toBe("17841400000000000");
  });
});
