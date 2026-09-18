/**
 * Guest persistence layer — IndexedDB via Dexie.
 *
 * Stores ONLY device-local convenience data, never authoritative commerce
 * state (orders, payments, prices, stock remain server-side in Supabase):
 *
 *   carts             — guest cart lines (mirrors the localStorage cart)
 *   checkout_draft    — in-progress checkout (form fields, chosen method)
 *   guest_addresses   — address the guest opted to save ("use next time")
 *   recently_viewed   — product slugs for "Recently viewed" surfaces
 *   meta              — guest id mirror + bookkeeping
 *
 * Every record carries `expiresAt`; `purgeExpired()` runs opportunistically
 * on access. TTLs (from your architecture note):
 *   cart → 30 days · checkout draft → 7 days · guest address → 30 days ·
 *   recently viewed → 60 days (max 24 entries)
 *
 * All APIs are safe to call during SSR (they no-op) and in private mode or
 * when storage is denied (errors are swallowed — the site works without it).
 * Dexie's typed tables + versioned schema keep migrations painless later.
 */
import Dexie, { type EntityTable } from "dexie";
import type { CartItem, DeliveryAddress, PaymentMethodId } from "@/lib/types";

/* ------------------------------- types ----------------------------------- */

export interface CartRecord {
  id: string; // `${slug}::${color}`
  slug: string;
  color: string;
  qty: number;
  name?: string;
  price?: number;
  image?: string;
  updatedAt: number;
  expiresAt: number;
}

export interface CheckoutDraftRecord {
  id: "draft"; // singleton
  form: Partial<DeliveryAddress>;
  paymentMethod?: PaymentMethodId;
  email?: string;
  updatedAt: number;
  expiresAt: number;
}

export interface GuestAddressRecord {
  id: "guest-address"; // singleton
  address: DeliveryAddress;
  updatedAt: number;
  expiresAt: number;
}

export interface RecentlyViewedRecord {
  slug: string; // primary key
  viewedAt: number;
  expiresAt: number;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}

/* ------------------------------- database -------------------------------- */

export const GUEST_DB_NAME = "thetanti-guest";
export const GUEST_DB_VERSION = 1;

/** TTLs in ms. */
export const TTL = {
  cart: 30 * 24 * 60 * 60 * 1000,
  draft: 7 * 24 * 60 * 60 * 1000,
  address: 30 * 24 * 60 * 60 * 1000,
  recentlyViewed: 60 * 24 * 60 * 60 * 1000,
  maxRecentlyViewed: 24,
} as const;

export const guestDb = new Dexie(GUEST_DB_NAME) as Dexie & {
  carts: EntityTable<CartRecord, "id">;
  checkout_draft: EntityTable<CheckoutDraftRecord, "id">;
  guest_addresses: EntityTable<GuestAddressRecord, "id">;
  recently_viewed: EntityTable<RecentlyViewedRecord, "slug">;
  meta: EntityTable<MetaRecord, "key">;
};

guestDb.version(GUEST_DB_VERSION).stores({
  carts: "id, updatedAt",
  checkout_draft: "id",
  guest_addresses: "id",
  recently_viewed: "slug, viewedAt",
  meta: "key",
});

/* ------------------------------ utilities -------------------------------- */

const hasIdb = () => typeof window !== "undefined" && "indexedDB" in window;

/** Remove expired rows across all tables; returns number purged. */
export async function purgeExpired(): Promise<number> {
  if (!hasIdb()) return 0;
  try {
    const now = Date.now();
    let purged = 0;
    await guestDb.transaction(
      "rw",
      [guestDb.carts, guestDb.checkout_draft, guestDb.guest_addresses, guestDb.recently_viewed],
      async () => {
        purged += await guestDb.carts.where("expiresAt").below(now).delete();
        purged += await guestDb.checkout_draft.where("expiresAt").below(now).delete();
        purged += await guestDb.guest_addresses.where("expiresAt").below(now).delete();
        purged += await guestDb.recently_viewed.where("expiresAt").below(now).delete();
      },
    );
    return purged;
  } catch {
    return 0;
  }
}

/* -------------------------------- cart ----------------------------------- */

export function cartKey(slug: string, color: string): string {
  return `${slug}::${color}`;
}

export async function dbGetCart(): Promise<CartItem[]> {
  if (!hasIdb()) return [];
  try {
    const rows = await guestDb.carts.where("expiresAt").above(Date.now()).toArray();
    return rows
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .map((r) => ({
        slug: r.slug,
        color: r.color,
        qty: r.qty,
        name: r.name,
        price: r.price,
        image: r.image,
      }));
  } catch {
    return [];
  }
}

export async function dbSetCart(items: CartItem[]): Promise<void> {
  if (!hasIdb()) return;
  try {
    const now = Date.now();
    await guestDb.transaction("rw", guestDb.carts, async () => {
      await guestDb.carts.clear();
      const rows: CartRecord[] = items.map((i) => ({
        id: cartKey(i.slug, i.color),
        slug: i.slug,
        color: i.color,
        qty: i.qty,
        name: i.name,
        price: i.price,
        image: i.image,
        updatedAt: now,
        expiresAt: now + TTL.cart,
      }));
      if (rows.length) await guestDb.carts.bulkPut(rows);
    });
  } catch {
    /* quota / private mode — the localStorage cart remains the fallback */
  }
}

/* ---------------------------- checkout draft ------------------------------ */

export async function dbSaveDraft(input: {
  form: Partial<DeliveryAddress>;
  paymentMethod?: PaymentMethodId;
  email?: string;
}): Promise<void> {
  if (!hasIdb()) return;
  try {
    const now = Date.now();
    await guestDb.checkout_draft.put({
      id: "draft",
      form: input.form,
      paymentMethod: input.paymentMethod,
      email: input.email,
      updatedAt: now,
      expiresAt: now + TTL.draft,
    });
  } catch {
    /* ignore */
  }
}

export async function dbGetDraft(): Promise<Omit<CheckoutDraftRecord, "id" | "updatedAt" | "expiresAt"> | null> {
  if (!hasIdb()) return null;
  try {
    const row = await guestDb.checkout_draft.get("draft");
    if (!row || row.expiresAt < Date.now()) return null;
    return { form: row.form, paymentMethod: row.paymentMethod, email: row.email };
  } catch {
    return null;
  }
}

export async function dbClearDraft(): Promise<void> {
  if (!hasIdb()) return;
  try {
    await guestDb.checkout_draft.delete("draft");
  } catch {
    /* ignore */
  }
}

/* ---------------------------- guest address ------------------------------- */

/** Save the guest address — only when the customer opts in. */
export async function dbSaveGuestAddress(address: DeliveryAddress): Promise<void> {
  if (!hasIdb()) return;
  try {
    const now = Date.now();
    await guestDb.guest_addresses.put({
      id: "guest-address",
      address,
      updatedAt: now,
      expiresAt: now + TTL.address,
    });
  } catch {
    /* ignore */
  }
}

export async function dbGetGuestAddress(): Promise<DeliveryAddress | null> {
  if (!hasIdb()) return null;
  try {
    const row = await guestDb.guest_addresses.get("guest-address");
    if (!row || row.expiresAt < Date.now()) return null;
    return row.address;
  } catch {
    return null;
  }
}

export async function dbClearGuestAddress(): Promise<void> {
  if (!hasIdb()) return;
  try {
    await guestDb.guest_addresses.delete("guest-address");
  } catch {
    /* ignore */
  }
}

/* ---------------------------- recently viewed ----------------------------- */

export async function dbTrackRecentlyViewed(slug: string): Promise<void> {
  if (!hasIdb() || !slug) return;
  try {
    const now = Date.now();
    await guestDb.recently_viewed.put({ slug, viewedAt: now, expiresAt: now + TTL.recentlyViewed });
    // Keep the list bounded.
    const all = await guestDb.recently_viewed.orderBy("viewedAt").reverse().toArray();
    const stale = all.slice(TTL.maxRecentlyViewed).map((r) => r.slug);
    if (stale.length) await guestDb.recently_viewed.bulkDelete(stale);
  } catch {
    /* ignore */
  }
}

/** Newest-first slugs (excluding the product currently being viewed). */
export async function dbGetRecentlyViewed(excludeSlug?: string): Promise<string[]> {
  if (!hasIdb()) return [];
  try {
    const rows = await guestDb.recently_viewed
      .where("expiresAt")
      .above(Date.now())
      .toArray();
    return rows
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .map((r) => r.slug)
      .filter((s) => s !== excludeSlug)
      .slice(0, TTL.maxRecentlyViewed);
  } catch {
    return [];
  }
}

/* -------------------------------- meta ------------------------------------ */

export async function dbSetMeta(key: string, value: unknown): Promise<void> {
  if (!hasIdb()) return;
  try {
    await guestDb.meta.put({ key, value });
  } catch {
    /* ignore */
  }
}

export async function dbGetMeta<T>(key: string): Promise<T | null> {
  if (!hasIdb()) return null;
  try {
    const row = await guestDb.meta.get(key);
    return row ? (row.value as T) : null;
  } catch {
    return null;
  }
}
