/**
 * Supabase backend (used when the backend selector is on).
 *
 * Everything runs through the request-scoped SSR client with Row Level
 * Security — no service-role key is used. Guest (signed-out) reads hit the
 * anon role; customer reads/writes run as the signed-in user; admin actions
 * are permitted by RLS via the `public.is_admin()` policy helper.
 *
 * Schema (supabase/migrations/0001_init.sql) mirrors the demo store's domain
 * types 1:1 so switching backends never touches the UI or business logic.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { supabaseServer } from "@/lib/supabase/server";
import {
  productToRow,
  toProduct,
  type OrderRow,
  type ProductRow,
  type ProfileRow,
} from "@/lib/supabase/rows";
import { CATEGORIES, PRODUCTS } from "@/lib/data/catalog";
import { defaultCostFor } from "@/lib/demo/cost";
import { SUPABASE_STORAGE_BUCKET } from "@/lib/backend/env";
import type {
  AddressBookAddress,
  Category,
  FulfilmentStatus,
  Order,
  PublicUser,
} from "@/lib/types";
import type { DbProduct, DbStatus } from "@/lib/demo/db";

export class SupabaseError extends Error {
  constructor(
    message: string,
    public code: "conflict" | "not_found" | "invalid" | "rate_limit",
  ) {
    super(message);
    this.name = "SupabaseError";
  }
}

/** Rethrow Postgres/REST errors as SupabaseError with friendly messages. */
function fail(err: { message?: string; code?: string }, fallback: string): never {
  const msg = err?.message ?? fallback;
  const code =
    err?.code === "23505" || /duplicate/i.test(msg) ? "conflict" : "invalid";
  throw new SupabaseError(msg, code);
}

function toUserRow(r: ProfileRow): PublicUser {
  return {
    id: r.id,
    name: r.full_name?.trim() || r.id.slice(0, 8),
    email: "", // filled from the auth user when known
    phone: r.phone ?? undefined,
    role: r.role,
    addresses: Array.isArray(r.addresses) ? (r.addresses as AddressBookAddress[]) : [],
    createdAt: r.created_at,
  };
}

/* ------------------------------ auth ------------------------------ */

export async function supabaseSignUp(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ ok: boolean; user?: PublicUser; needsConfirm?: boolean; error?: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.name, phone: input.phone ?? "" },
    },
  });
  if (error) return { ok: false, error: error.message };
  if (!data.user) {
    return { ok: false, error: "Could not create the account" };
  }
  // Email confirmation on: no session yet — the user must confirm first.
  if (!data.session) {
    return { ok: true, needsConfirm: true };
  }
  const user = await ensureProfile(data.user.id, data.user.email);
  return user ? { ok: true, user } : { ok: false, error: "Could not create the account" };
}

export async function supabaseSignIn(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: PublicUser; error?: string }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error || !data.user) {
    return { ok: false, error: "Incorrect email or password" };
  }
  const user = await ensureProfile(data.user.id, data.user.email);
  return user ? { ok: true, user } : { ok: false, error: "Profile not found" };
}

export async function supabaseSignOut(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
}

/** Resolve the signed-in user from the cookie session (or null). */
export async function supabaseCurrentUser(): Promise<PublicUser | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const auth = data.user;
  if (!auth) return null;
  const user = await ensureProfile(auth.id, auth.email);
  return user;
}

/**
 * Read (or create) the profile row for an auth user. The first profile ever
 * created is auto-promoted to admin by a database trigger, which makes
 * bootstrapping the store simple: register once after the migration runs.
 */
async function ensureProfile(
  userId: string,
  email: string | null | undefined,
): Promise<PublicUser | null> {
  const supabase = await supabaseServer();
  let { data: row } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (!row) {
    // Register-trigger may already have inserted — upsert is idempotent.
    const { error: upErr } = await supabase
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" });
    if (upErr) return null;
    const after = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    row = after.data as ProfileRow | null;
  }
  if (!row) return null;
  const user = toUserRow(row as ProfileRow);
  user.email = email ?? "";
  return user;
}

/* --------------------------- addresses --------------------------- */

export async function supabaseSaveAddresses(
  userId: string,
  addresses: AddressBookAddress[],
): Promise<PublicUser | null> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .update({ addresses: JSON.stringify(addresses), updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("*")
    .single();
  if (error || !data) return null;
  return toUserRow(data as ProfileRow);
}

/* --------------------------- catalogue --------------------------- */

export async function supabaseListProducts(): Promise<DbProduct[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("products").select("*");
  if (error) fail(error, "Could not load products");
  return (data as ProductRow[]).map(toProduct) as unknown as DbProduct[];
}

export async function supabaseActiveProducts(): Promise<DbProduct[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("db_status", "active");
  if (error) fail(error, "Could not load products");
  return (data as ProductRow[]).map(toProduct) as unknown as DbProduct[];
}

export async function supabaseProductBySlug(
  slug: string,
): Promise<DbProduct | undefined> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("slug", slug)
    .eq("db_status", "active")
    .maybeSingle();
  if (error) return undefined;
  return data ? (toProduct(data as ProductRow) as unknown as DbProduct) : undefined;
}

/** Upsert a product (row keyed by slug), mirroring the demo store semantics. */
export async function supabaseUpsertProduct(
  input: Partial<DbProduct> & { slug: string },
): Promise<DbProduct> {
  const supabase = await supabaseServer();
  const existing = await supabase
    .from("products")
    .select("id")
    .eq("slug", input.slug)
    .maybeSingle();
  const patch = Object.fromEntries(
    Object.entries(productToRow(input as Record<string, unknown>)).filter(
      ([, v]) => v !== undefined,
    ),
  );
  if (existing.error) fail(existing.error, "Could not look up the product");
  if (existing.data) {
    const { data, error } = await supabase
      .from("products")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("slug", input.slug)
      .select("*")
      .single();
    if (error) fail(error, "Could not update the product");
    return toProduct(data as ProductRow) as unknown as DbProduct;
  }
  const { data, error } = await supabase
    .from("products")
    .insert(patch)
    .select("*")
    .single();
  if (error) fail(error, "Could not create the product");
  return toProduct(data as ProductRow) as unknown as DbProduct;
}

export async function supabaseDeleteProduct(slug: string): Promise<void> {
  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("products")
    .update({ db_status: "deleted", updated_at: new Date().toISOString() })
    .eq("slug", slug);
  if (error) fail(error, "Could not delete the product");
}

/* --------------------------- categories --------------------------- */

export async function supabaseListCategories(): Promise<Category[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name");
  if (error) return [];
  return (data ?? []).map((c) => ({
    slug: String(c.slug),
    name: String(c.name),
    short: String(c.short),
    blurb: String(c.blurb),
  }));
}

export async function supabaseCreateCategory(input: {
  name: string;
  short: string;
  blurb: string;
}): Promise<Category> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      slug: String(input.name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: input.name.trim(),
      short: input.short.trim() || input.name.trim(),
      blurb: input.blurb.trim(),
    })
    .select("*")
    .single();
  if (error) fail(error, "Could not create the category");
  const c = data as { slug: string; name: string; short: string; blurb: string };
  return { slug: c.slug, name: c.name, short: c.short, blurb: c.blurb };
}

export async function supabaseUpdateCategory(
  slug: string,
  patch: { name?: string; short?: string; blurb?: string },
): Promise<Category> {
  const supabase = await supabaseServer();
  const body: Record<string, string> = {};
  if (patch.name !== undefined) body.name = patch.name.trim();
  if (patch.short !== undefined) body.short = patch.short.trim();
  if (patch.blurb !== undefined) body.blurb = patch.blurb.trim();
  const { data, error } = await supabase
    .from("categories")
    .update(body)
    .eq("slug", slug)
    .select("*")
    .single();
  if (error) {
    if (!error.message?.includes("returned zero rows")) fail(error, "Could not update the category");
    throw new SupabaseError("Category not found", "not_found");
  }
  const c = data as { slug: string; name: string; short: string; blurb: string };
  return { slug: c.slug, name: c.name, short: c.short, blurb: c.blurb };
}

export async function supabaseRemoveCategory(slug: string): Promise<void> {
  const supabase = await supabaseServer();
  const used = await supabase
    .from("products")
    .select("id")
    .eq("category", slug)
    .neq("db_status", "deleted")
    .limit(1);
  if (used.error) fail(used.error, "Could not check the category");
  if (used.data?.length) {
    throw new SupabaseError(
      "Category still has products — move or delete them first",
      "invalid",
    );
  }
  const { error } = await supabase.from("categories").delete().eq("slug", slug);
  if (error) {
    if (!error.message?.includes("returned zero rows")) fail(error, "Could not delete the category");
    throw new SupabaseError("Category not found", "not_found");
  }
}

/* ------------------------------ orders ------------------------------ */

function toOrder(r: OrderRow): Order {
  const items = Array.isArray(r.items) ? r.items : [];
  const address = (r.address as Order["address"]) ?? {
    fullName: "",
    phone: "",
    pincode: "",
    line1: "",
    city: "",
    state: "",
  };
  const utmRaw = r.utm as Order["utm"] | null;
  return {
    id: r.id,
    number: String(r.number),
    items: items as Order["items"],
    subtotal: Number(r.subtotal),
    shipping: Number(r.shipping),
    total: Number(r.total),
    paymentMethod: String(r.payment_method) as Order["paymentMethod"],
    paymentStatus: String(r.payment_status) as Order["paymentStatus"],
    status: String(r.status) as Order["status"],
    razorpayOrderId: r.razorpay_order_id ?? undefined,
    razorpayPaymentId: r.razorpay_payment_id ?? undefined,
    address,
    utm: utmRaw ?? undefined,
    storedIn: (String(r.stored_in) as Order["storedIn"]) ?? "supabase",
    createdAt: r.created_at,
    estimatedDelivery: r.estimated_delivery ?? r.created_at,
    fulfilment: (String(r.fulfilment) as FulfilmentStatus) ?? "pending",
    userId: r.user_id ?? undefined,
    userEmail: r.user_email ?? undefined,
    updatedAt: r.updated_at,
  };
}

function orderToRow(o: Order): Record<string, unknown> {
  return {
    number: o.number,
    user_id: o.userId ?? null,
    user_email: o.userEmail ?? null,
    items: JSON.stringify(o.items),
    subtotal: o.subtotal,
    shipping: o.shipping,
    total: o.total,
    payment_method: o.paymentMethod,
    payment_status: o.paymentStatus,
    status: o.status,
    razorpay_order_id: o.razorpayOrderId ?? null,
    razorpay_payment_id: o.razorpayPaymentId ?? null,
    address: JSON.stringify(o.address),
    utm: o.utm ? JSON.stringify(o.utm) : null,
    fulfilment: o.fulfilment ?? "pending",
    stored_in: "supabase",
    estimated_delivery: o.estimatedDelivery,
  };
}

export async function supabaseAddOrder(order: Order): Promise<Order> {
  // Guests (user_id = null) can INSERT under RLS but their rows are invisible
  // to SELECT, so `insert ... returning` fails with an RLS error. Generate the
  // id here (uuid column) and return the input order + id instead of reading
  // the row back — the persisted shape is identical.
  const supabase = await supabaseServer();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("orders")
    .insert({ ...orderToRow(order), id });
  if (error) fail(error, "Could not save your order");
  return { ...order, id };
}

export async function supabaseOrdersForUser(userId: string): Promise<Order[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as OrderRow[]).map(toOrder);
}

export async function supabaseFindOrderById(orderId: string): Promise<Order | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  return data ? toOrder(data as OrderRow) : null;
}

/**
 * Confirm a payment via the security-definer `confirm_payment` RPC (secrets
 * live only in the database — no service-role key required). The RPC verifies
 * the HMAC signature and amount itself and is idempotent.
 */
export async function supabaseConfirmPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  paymentSignature?: string;
  webhookBody?: string;
  webhookSignature?: string;
  amountPaise: number;
  /** Client order id — ties the confirmation to that exact order. */
  orderId?: string;
}): Promise<{ ok: boolean; error?: string; order?: Order }> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("confirm_payment", {
    p_razorpay_order_id: input.razorpayOrderId,
    p_razorpay_payment_id: input.razorpayPaymentId ?? "",
    p_payment_signature: input.paymentSignature ?? "",
    p_webhook_body: input.webhookBody ?? "",
    p_webhook_signature: input.webhookSignature ?? "",
    p_amount_paise: Math.round(input.amountPaise),
    p_order_id: input.orderId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  // The security-definer RPC returns the updated row as jsonb (guests can't
  // read their rows through RLS, so this is the authoritative read path).
  const row = data as OrderRow | null;
  return row
    ? { ok: true, order: toOrder(row) }
    : { ok: false, error: "Payment could not be matched to an order" };
}

export async function supabaseAllOrders(): Promise<Order[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data as OrderRow[]).map(toOrder);
}

export async function supabaseSetOrderFulfilment(
  orderId: string,
  status: FulfilmentStatus,
): Promise<Order> {
  const supabase = await supabaseServer();
  const patch: Record<string, unknown> = {
    fulfilment: status,
    updated_at: new Date().toISOString(),
  };
  if (status === "cancelled") {
    patch.status = "cancelled";
    patch.payment_status = "pending";
  }
  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .select("*")
    .single();
  if (error) {
    if (!error.message?.includes("returned zero rows")) fail(error, "Could not update the order");
    throw new SupabaseError("Order not found", "not_found");
  }
  return toOrder(data as OrderRow);
}

/* ---------------------------- customers ---------------------------- */

export async function supabaseCustomers(): Promise<
  (PublicUser & { ordersCount: number; totalSpend: number })[]
> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("role", "customer")
    .order("created_at", { ascending: false });
  if (error) return [];
  const orders = await supabaseAllOrders();
  return (data as ProfileRow[]).map((r) => {
    const u = toUserRow(r);
    const theirs = orders.filter((o) => o.userId === r.id);
    return {
      ...u,
      ordersCount: theirs.length,
      totalSpend: theirs.reduce((s, o) => s + o.total, 0),
    };
  });
}

/* ------------------------------ media ------------------------------ */

/** Upload a product image into the public "Sharee" bucket. */
export async function supabaseSaveMedia(
  file: File,
): Promise<string> {
  const supabase = await supabaseServer();
  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const allowed = ["jpg", "jpeg", "png", "webp"];
  if (!allowed.includes(ext)) {
    throw new SupabaseError("Unsupported image type", "invalid");
  }
  const path = `products/${Date.now()}-${randomUUID().slice(0, 8)}.${ext === "jpeg" ? "jpg" : ext}`;
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) fail(error, "Upload failed");
  const { data } = supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .getPublicUrl(path);
  return data.publicUrl;
}

export async function supabaseDeleteMedia(url: string): Promise<void> {
  const clean = url.trim();
  if (!clean) return;
  const marker = `/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/`;
  const index = clean.indexOf(marker);
  if (index === -1) return;
  const storagePath = decodeURIComponent(clean.slice(index + marker.length));
  if (!storagePath || storagePath.includes("..")) return;
  const supabase = await supabaseServer();
  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE_BUCKET)
    .remove([storagePath]);
  if (error) fail(error, "Could not delete image from storage");
}

/* ------------------------------- seed ------------------------------- */

/**
 * First-run bootstrap for a fresh Supabase project: when the catalogue is
 * empty (schema just applied), populate categories + products from the seed
 * catalogue so the storefront and admin have data to work with. Called from
 * the admin product list route, so it runs under the first admin's session.
 */
export async function supabaseEnsureSeed(): Promise<boolean> {
  const supabase = await supabaseServer();
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .limit(1);
  if (count && count > 0) return false;

  const now = new Date().toISOString();
  for (const c of CATEGORIES) {
    const { error } = await supabase
      .from("categories")
      .upsert(
        { slug: c.slug, name: c.name, short: c.short, blurb: c.blurb, created_at: now },
        { onConflict: "slug" },
      );
    if (error) return false;
  }
  const rows = PRODUCTS.map((p) => ({
    ...productToRow(p as unknown as Record<string, unknown>),
    id: randomUUID(),
    cost: defaultCostFor(p.category, p.price),
    db_status: "active" as DbStatus,
    created_at: p.createdAt,
    updated_at: p.createdAt,
  }));
  const { error } = await supabase.from("products").insert(rows);
  return !error;
}
