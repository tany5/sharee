import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * Anonymous guest id — issued once per browser as a first-party cookie and
 * mirrored into IndexedDB meta. It is ONLY a convenience identifier for
 * prefilling local data; it never authorizes anything server-side.
 */
export const GUEST_COOKIE = "thetanti_guest_id";

export async function GET() {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) {
    return NextResponse.json({ ok: true, guestId: existing, created: false });
  }
  const guestId = `guest_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  store.set(GUEST_COOKIE, guestId, {
    httpOnly: false, // readable client-side so IndexedDB data can be tied to it
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });
  return NextResponse.json({ ok: true, guestId, created: true });
}
