import type { Utm } from "@/lib/types";

const KEYS = ["source", "medium", "campaign", "content", "term", "fbclid"] as const;

/**
 * Read UTM params (and fbclid) from the current browser URL so every order can
 * answer: "which ad generated this order?". Call before navigating away.
 */
export function readUtmFromUrl(url = window.location.search): Utm | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(url);
  const utm: Partial<Record<(typeof KEYS)[number], string>> = {};
  let any = false;
  for (const key of KEYS) {
    // fbclid arrives as ?fbclid=, the rest as ?utm_<key>=
    const value = key === "fbclid" ? params.get("fbclid") : params.get(`utm_${key}`);
    const clean = value?.trim().slice(0, 300);
    if (clean) {
      utm[key] = clean;
      any = true;
    }
  }
  return any ? (utm as Utm) : undefined;
}
