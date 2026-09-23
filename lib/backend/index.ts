/**
 * Backend facade — the single import point for store data access.
 *
 * Every function dispatches to the active backend (see lib/backend/env.ts):
 *
 *   demo     → .demo-data/db.json + local uploads (zero-config local mode)
 *   supabase → Supabase DB + Auth + the public "Sharee" storage bucket
 *
 * Errors from either backend carry a `code` in
 * ("conflict" | "not_found" | "in_use" | "invalid") plus `message`, so API
 * routes translate them to HTTP responses without knowing the backend.
 */
import "server-only";
import { cookies } from "next/headers";
import { isSupabaseBackend } from "@/lib/backend/env";
import type {
  AddressBookAddress,
  Category,
  FulfilmentStatus,
  Order,
  Product,
  PublicUser,
} from "@/lib/types";
import type { DbProduct, DbStatus } from "@/lib/demo/db";
import type { TrackedOrder } from "@/lib/tracking";

/* ------------------------- demo implementation ------------------------- */

const demo = async () => {
  const mod = await import("@/lib/demo/db");
  return mod;
};

async function demoSessionCookie() {
  const store = await cookies();
  return store.get("ambika_session")?.value;
}

async function demoSetSessionCookie(token: string) {
  const store = await cookies();
  store.set("ambika_session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

async function demoClearSessionCookie() {
  const store = await cookies();
  store.delete("ambika_session");
}

async function demoRegister(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ ok: boolean; user?: PublicUser; needsConfirm?: boolean; error?: string }> {
  const db = await demo();
  const user = await db.createUser({
    name: input.name,
    email: input.email,
    phone: input.phone,
    password: input.password,
    role: "customer",
  });
  const token = db.createSession(user.id);
  await demoSetSessionCookie(token);
  return { ok: true, user };
}

async function demoLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: PublicUser; error?: string }> {
  const db = await demo();
  const { verifyPassword } = await import("@/lib/auth/password");
  const stored = db.findUserByEmail(email);
  if (!stored || !verifyPassword(password, stored.passwordSalt, stored.passwordHash)) {
    return { ok: false, error: "Incorrect email or password" };
  }
  const token = db.createSession(stored.id);
  await demoSetSessionCookie(token);
  const user: PublicUser = {
    id: stored.id,
    name: stored.name,
    email: stored.email,
    phone: stored.phone,
    role: stored.role,
    addresses: stored.addresses,
    createdAt: stored.createdAt,
  };
  return { ok: true, user };
}

async function demoLogout(): Promise<void> {
  const db = await demo();
  const token = await demoSessionCookie();
  if (token) db.destroySession(token);
  await demoClearSessionCookie();
}

async function demoCurrentUser(): Promise<PublicUser | null> {
  const db = await demo();
  const token = await demoSessionCookie();
  if (!token) return null;
  return db.userForSession(token) ?? null;
}

async function demoSaveAddresses(
  userId: string,
  addresses: AddressBookAddress[],
): Promise<PublicUser | null> {
  const db = await demo();
  return db.updateUserAddresses(userId, addresses);
}

/* ------------------------ supabase implementation ------------------------ */

async function supabaseModule() {
  return import("@/lib/supabase/backend");
}

async function supabaseRegister(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ ok: boolean; user?: PublicUser; needsConfirm?: boolean; error?: string }> {
  return (await supabaseModule()).supabaseSignUp(input);
}

async function supabaseLogin(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: PublicUser; error?: string }> {
  return (await supabaseModule()).supabaseSignIn(email, password);
}

async function supabaseLogout(): Promise<void> {
  return (await supabaseModule()).supabaseSignOut();
}

async function supabaseCurrentUser(): Promise<PublicUser | null> {
  return (await supabaseModule()).supabaseCurrentUser();
}

async function supabaseSaveAddresses(
  userId: string,
  addresses: AddressBookAddress[],
): Promise<PublicUser | null> {
  return (await supabaseModule()).supabaseSaveAddresses(userId, addresses);
}

/* ------------------------------- facade API ------------------------------- */

const active = () => isSupabaseBackend();

export async function registerUser(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
}): Promise<{ ok: boolean; user?: PublicUser; needsConfirm?: boolean; error?: string }> {
  return active() ? supabaseRegister(input) : demoRegister(input);
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: boolean; user?: PublicUser; needsConfirm?: boolean; error?: string }> {
  return active() ? supabaseLogin(email, password) : demoLogin(email, password);
}

export async function logoutUser(): Promise<void> {
  return active() ? supabaseLogout() : demoLogout();
}

export async function currentUser(): Promise<PublicUser | null> {
  return active() ? supabaseCurrentUser() : demoCurrentUser();
}

export async function saveAddresses(
  userId: string,
  addresses: AddressBookAddress[],
): Promise<PublicUser | null> {
  return active()
    ? supabaseSaveAddresses(userId, addresses)
    : demoSaveAddresses(userId, addresses);
}

/* ------------------------------- catalogue ------------------------------- */

export async function storeProducts(): Promise<Product[]> {
  if (active()) return (await supabaseModule()).supabaseActiveProducts();
  const db = await demo();
  const { PRODUCTS } = await import("@/lib/data/catalog");
  if (!db.isDbInitialised()) return PRODUCTS;
  return db.publicProducts();
}

export async function storeCategories(): Promise<Category[]> {
  if (active()) return (await supabaseModule()).supabaseListCategories();
  const db = await demo();
  const { CATEGORIES } = await import("@/lib/data/catalog");
  if (!db.isDbInitialised()) return CATEGORIES;
  return db.categories();
}

export async function storeProductBySlug(slug: string): Promise<Product | undefined> {
  if (active()) return (await supabaseModule()).supabaseProductBySlug(slug);
  const db = await demo();
  const { PRODUCTS } = await import("@/lib/data/catalog");
  try {
    const fromDb = db.publicProductBySlug(slug);
    if (fromDb) return fromDb;
  } catch {
    /* fall through */
  }
  return PRODUCTS.find((p) => p.slug === slug);
}

export async function resolveOrderSource(
  slug: string,
): Promise<{ name: string; price: number; cost: number; stock?: number } | undefined> {
  if (active()) {
    const row = await (await supabaseModule()).supabaseProductBySlug(slug);
    if (!row) return undefined;
    return { name: row.name, price: row.price, cost: row.cost, stock: row.stock };
  }
  const mod = await import("@/lib/demo/db");
  return mod.orderProductBySlug(slug);
}

/* --------------------------- admin operations --------------------------- */

export async function adminProducts(): Promise<DbProduct[]> {
  if (active()) return (await supabaseModule()).supabaseListProducts();
  return (await demo()).adminProducts();
}

export async function upsertProduct(
  input: Partial<DbProduct> & { slug: string },
): Promise<DbProduct> {
  if (active()) return (await supabaseModule()).supabaseUpsertProduct(input);
  return (await demo()).upsertProduct(input);
}

export async function deleteProduct(slug: string): Promise<void> {
  if (active()) return (await supabaseModule()).supabaseDeleteProduct(slug);
  return (await demo()).deleteProduct(slug);
}

export async function listCategoriesAll(): Promise<Category[]> {
  if (active()) return (await supabaseModule()).supabaseListCategories();
  return (await demo()).categories();
}

export async function createCategory(input: {
  name: string;
  short: string;
  blurb: string;
}): Promise<Category> {
  if (active()) return (await supabaseModule()).supabaseCreateCategory(input);
  return (await demo()).createCategory(input);
}

export async function updateCategory(
  slug: string,
  patch: { name?: string; short?: string; blurb?: string },
): Promise<Category> {
  if (active()) return (await supabaseModule()).supabaseUpdateCategory(slug, patch);
  return (await demo()).updateCategory(slug, patch);
}

export async function removeCategory(slug: string): Promise<void> {
  if (active()) return (await supabaseModule()).supabaseRemoveCategory(slug);
  return (await demo()).removeCategory(slug);
}

/* -------------------------------- orders -------------------------------- */

export async function ordersForUser(userId: string): Promise<Order[]> {
  if (active()) return (await supabaseModule()).supabaseOrdersForUser(userId);
  return (await demo()).ordersForUser(userId);
}

export async function allOrders(): Promise<Order[]> {
  if (active()) return (await supabaseModule()).supabaseAllOrders();
  return (await demo()).allOrders();
}

export async function addOrder(order: Order): Promise<Order> {
  if (active()) return (await supabaseModule()).supabaseAddOrder(order);
  return (await demo()).addOrder(order);
}

export async function findOrderById(orderId: string): Promise<Order | null> {
  if (active()) return (await supabaseModule()).supabaseFindOrderById(orderId);
  return (await demo()).findOrderById(orderId) ?? null;
}

/**
 * Confirm a Razorpay payment server-side and flip the order to paid. Route
 * layers already verified the payment/webhook signature; backends additionally
 * cross-check the paid amount against the order total (demo writes the local
 * file, Supabase runs the security-definer `confirm_payment` RPC).
 */
export async function confirmRazorpayPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  paymentSignature?: string;
  webhookBody?: string;
  webhookSignature?: string;
  amountPaise: number;
  /** Client order id — ties the confirmation to that exact order. */
  orderId?: string;
}): Promise<{ ok: boolean; error?: string; order?: Order }> {
  if (active()) return (await supabaseModule()).supabaseConfirmPayment(input);
  return (await demo()).confirmPayment(input);
}

/**
 * Confirm a Cashfree payment server-side and flip the order to paid. Route
 * layers already verified the payment (Cashfree Orders API status fetch or
 * webhook signature); backends cross-check the paid amount against the order
 * total (demo writes the local file, Supabase runs the security-definer
 * `confirm_cashfree_payment` RPC).
 */
export async function confirmCashfreePayment(input: {
  cashfreeOrderId: string;
  cashfreePaymentId?: string;
  amountPaise: number;
  /** Client order id — ties the confirmation to that exact order. */
  orderId?: string;
}): Promise<{ ok: boolean; error?: string; order?: Order }> {
  if (active()) {
    return (await supabaseModule()).supabaseConfirmCashfreePayment(input);
  }
  return (await demo()).confirmCashfreePayment(input);
}

export async function setOrderFulfilment(
  orderId: string,
  status: FulfilmentStatus,
): Promise<Order> {
  if (active()) {
    return (await supabaseModule()).supabaseSetOrderFulfilment(orderId, status);
  }
  return (await demo()).setOrderFulfilment(orderId, status);
}

/** Admin: save courier/AWB shipment details on an order. */
export async function setOrderTracking(
  orderId: string,
  tracking: Order["tracking"],
): Promise<Order> {
  if (active()) {
    return (await supabaseModule()).supabaseSetOrderTracking(orderId, tracking);
  }
  return (await demo()).setOrderTracking(orderId, tracking);
}

/**
 * Public /track lookup: order number + phone (the phone check is the auth).
 * Demo mode returns the full Order (the route projects it to TrackedOrder via
 * toTrackedOrder); Supabase mode returns the customer-safe shape directly
 * from the security-definer `track_order` RPC. Null on no match.
 */
export async function findOrderForTracking(
  orderNumber: string,
  phone: string,
): Promise<Order | TrackedOrder | null> {
  if (active()) {
    return (await supabaseModule()).supabaseFindOrderForTracking(orderNumber, phone);
  }
  const mod = await import("@/lib/demo/db");
  return mod.findOrderForTracking(orderNumber, phone) ?? null;
}

/* ------------------------------- customers ------------------------------- */

export async function customersWithStats(): Promise<
  (PublicUser & { ordersCount: number; totalSpend: number })[]
> {
  if (active()) return (await supabaseModule()).supabaseCustomers();
  const db = await demo();
  const orders = db
    .allOrders()
    .filter((o) => o.fulfilment !== "cancelled" && o.paymentStatus !== "pending");
  return db
    .publicUsers()
    .filter((u) => u.role === "customer")
    .map((u) => {
      const theirs = orders.filter((o) => o.userId === u.id);
      return {
        ...u,
        ordersCount: theirs.length,
        totalSpend: theirs.reduce((s, o) => s + o.total, 0),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/* -------------------------------- media -------------------------------- */

/** Persist an uploaded product image; returns a displayable URL. */
export async function saveMediaFile(file: File): Promise<string> {
  if (active()) return (await supabaseModule()).supabaseSaveMedia(file);
  const db = await demo();
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const buffer = Buffer.from(await file.arrayBuffer());
  return db.saveMedia(buffer, ext);
}

/** Delete uploaded product images that are no longer referenced by a product. */
export async function deleteMediaFiles(urls: string[]): Promise<void> {
  const unique = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  if (active()) {
    const mod = await supabaseModule();
    await Promise.all(unique.map((url) => mod.supabaseDeleteMedia(url)));
    return;
  }
  const db = await demo();
  unique.forEach((url) => db.deleteMedia(url));
}

/** Product images served through the demo file route (Supabase has URLs). */
export function mediaNeedsLocalProxy(): boolean {
  return !active();
}

/* ------------------------------- seeding ------------------------------- */

/** Bootstrap empty catalogues (demo seeds itself; Supabase needs a first run). */
export async function ensureStoreSeeded(): Promise<void> {
  if (process.env.DISABLE_STORE_SEED?.trim().toLowerCase() === "true") return;
  if (!active()) return;
  await (await supabaseModule()).supabaseEnsureSeed();
}

/** Admin credentials hint shown on the login page (demo backend only). */
export async function demoAdminHint(): Promise<
  { email: string; password: string } | undefined
> {
  if (active()) return undefined;
  const db = await demo();
  return db.DEMO_ADMIN;
}

/** Re-exported for feature checks elsewhere. */
export { isSupabaseBackend };
export type { DbStatus };
