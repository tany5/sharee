/**
 * Demo persistence layer (server-only).
 *
 * A single JSON document (`.demo-data/db.json`) holds categories, products,
 * users, sessions and orders, plus an uploads folder for product images. The
 * storefront reads through lib/data/queries.ts and the admin panel mutates
 * through /api/admin/* — so admin edits show up in the store on refresh with
 * zero external services.
 *
 * Production path: swap this module for a Supabase client backed by
 * supabase/migrations/0001_init.sql (shapes mirror that schema on purpose).
 */
import "server-only";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { CATEGORIES, PRODUCTS } from "@/lib/data/catalog";
import type {
  AddressBookAddress,
  Category,
  DbStatus,
  Order,
  Product,
  PublicUser,
  FulfilmentStatus,
} from "@/lib/types";
export type { DbStatus };
import { hashPassword } from "@/lib/auth/password";
import { defaultCostFor } from "@/lib/demo/cost";

/** Product row as persisted (admin-managed superset of Product). */
export interface DbProduct extends Product {
  cost: number;
  images: string[];
  dbStatus: DbStatus;
  isCustom: boolean;
  updatedAt: string;
  /** AI marketing pipeline blob (lib/marketing/types) — demo store mirror of
   * Supabase's products.marketing jsonb column. Present when the product has
   * ever entered the pipeline. Untyped here; parse via parseMarketing(). */
  marketing?: unknown;
}

export interface StoredUser extends PublicUser {
  passwordSalt: string;
  passwordHash: string;
}

interface SessionEntry {
  userId: string;
  expires: string;
}

interface DbShape {
  version: number;
  products: DbProduct[];
  categories: Category[];
  users: StoredUser[];
  sessions: Record<string, SessionEntry>;
  orders: Order[];
}

export class DbError extends Error {
  constructor(
    message: string,
    public code: "conflict" | "not_found" | "in_use" | "invalid",
  ) {
    super(message);
    this.name = "DbError";
  }
}

/* ------------------------------ paths & io ------------------------------ */

const DATA_DIR = path.join(process.cwd(), ".demo-data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function ensureDirs(): void {
  mkdirSync(DATA_DIR, { recursive: true });
  mkdirSync(UPLOADS_DIR, { recursive: true });
}

/* (cost defaults live in lib/demo/cost.ts) */

/* ------------------------------ seeding ------------------------------ */

const ADMIN_EMAIL = "admin@thetanti.in";
const ADMIN_PASSWORD = "admin123";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function seedDb(): DbShape {
  const adminHash = hashPassword(ADMIN_PASSWORD);
  const now = new Date().toISOString();
  const admin: StoredUser = {
    id: "usr_admin",
    name: "Store Admin",
    email: ADMIN_EMAIL,
    phone: "+91 90000 00000",
    role: "admin",
    addresses: [],
    createdAt: now,
    passwordSalt: adminHash.salt,
    passwordHash: adminHash.hash,
  };

  return {
    version: 1,
    categories: CATEGORIES.map((c) => ({ ...c })),
    products: PRODUCTS.map((p) => ({
      ...p,
      cost: defaultCostFor(p.category, p.price),
      images: [],
      dbStatus: "active" as const,
      isCustom: false,
      updatedAt: p.createdAt,
    })),
    users: [admin],
    sessions: {},
    orders: [],
  };
}

function readDbFile(): DbShape | null {
  if (!existsSync(DB_PATH)) return null;
  try {
    return JSON.parse(readFileSync(DB_PATH, "utf8")) as DbShape;
  } catch {
    return null;
  }
}

let cacheMtime = -1;
let cached: DbShape | null = null;

/** Read the DB (cached by mtime), seeding from the catalogue on first run. */
export function getDb(): DbShape {
  try {
    const mtime = statSync(DB_PATH).mtimeMs;
    if (mtime !== cacheMtime) {
      cached = readDbFile();
      cacheMtime = mtime;
    }
  } catch {
    cached = null;
  }
  if (!cached) {
    ensureDirs();
    cached = seedDb();
    persist(cached);
  }
  return cached;
}

function persist(db: DbShape): void {
  ensureDirs();
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(db, null, 2));
  renameSync(tmp, DB_PATH);
  cached = db;
  try {
    cacheMtime = statSync(DB_PATH).mtimeMs;
  } catch {
    cacheMtime = Date.now();
  }
}

/* Mutations queue so concurrent API calls cannot clobber each other. */
let writeChain: Promise<unknown> = Promise.resolve();

function mutate<T>(fn: (db: DbShape) => T): Promise<T> {
  const run = writeChain.then(() => {
    const db = getDb();
    const result = fn(db);
    persist(db);
    return result;
  });
  writeChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Whether the demo DB file exists yet (false = use seed catalogue). */
export function isDbInitialised(): boolean {
  return existsSync(DB_PATH);
}

/* ------------------------------ products ------------------------------ */

export function publicProducts(): Product[] {
  return getDb().products
    .filter((p) => p.dbStatus === "active")
    .map((p) => ({ ...p }));
}

export function publicProductBySlug(slug: string): Product | undefined {
  const row = getDb().products.find(
    (p) => p.slug === slug && p.dbStatus === "active",
  );
  return row ? { ...row } : undefined;
}

export function adminProducts(): DbProduct[] {
  return getDb().products
    .filter((p) => p.dbStatus !== "deleted")
    .map((p) => ({ ...p }));
}

/** Resolve product details for order creation (authoritative pricing). */
export function orderProductBySlug(
  slug: string,
): { name: string; price: number; cost: number; stock: number } | undefined {
  const row = getDb().products.find(
    (p) => p.slug === slug && p.dbStatus === "active",
  );
  if (!row) return undefined;
  return { name: row.name, price: row.price, cost: row.cost, stock: row.stock };
}

export async function upsertProduct(
  input: Partial<DbProduct> & { slug: string },
): Promise<DbProduct> {
  return mutate((db) => {
    const now = new Date().toISOString();
    const existing = db.products.find((p) => p.slug === input.slug);
    if (existing) {
      Object.assign(existing, input, {
        updatedAt: now,
        dbStatus: input.dbStatus ?? existing.dbStatus,
      });
      return { ...existing };
    }
    const seed = PRODUCTS.find((p) => p.slug === input.slug);
    const basePrice = input.price ?? 199;
    const row: DbProduct = {
      id: input.id ?? `prd_${randomBytes(6).toString("hex")}`,
      name: input.name ?? "New Saree",
      slug: input.slug,
      category: input.category ?? "cotton-sarees",
      description: input.description ?? "",
      details: input.details ?? "",
      fabric: input.fabric ?? "",
      occasion: input.occasion ?? "",
      colorway: input.colorway ?? "Maroon",
      colors: input.colors?.length ? input.colors : [input.colorway ?? "Maroon"],
      price: basePrice,
      stock: input.stock ?? 10,
      rating: input.rating ?? 0,
      reviewCount: input.reviewCount ?? 0,
      tags: input.tags ?? [],
      featured: input.featured ?? false,
      createdAt: now,
      cost: input.cost ?? defaultCostFor(input.category ?? "", basePrice),
      images: input.images ?? [],
      dbStatus: input.dbStatus ?? "draft",
      isCustom: !seed,
      updatedAt: now,
    };
    db.products.unshift(row);
    return { ...row };
  });
}

export async function deleteProduct(slug: string): Promise<void> {
  await mutate((db) => {
    const row = db.products.find((p) => p.slug === slug);
    if (!row) throw new DbError("Product not found", "not_found");
    row.dbStatus = "deleted";
    row.updatedAt = new Date().toISOString();
  });
}

/* ------------------------------ categories ------------------------------ */

export function categories(): Category[] {
  return getDb().categories.map((c) => ({ ...c }));
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "item"
  );
}

export async function createCategory(input: {
  name: string;
  short: string;
  blurb: string;
}): Promise<Category> {
  const slug = slugify(input.name);
  return mutate((db) => {
    if (db.categories.some((c) => c.slug === slug)) {
      throw new DbError("A category with this name already exists", "conflict");
    }
    const category: Category = {
      slug,
      name: input.name.trim(),
      short: input.short.trim() || input.name.trim(),
      blurb: input.blurb.trim(),
    };
    db.categories.push(category);
    return { ...category };
  });
}

export async function updateCategory(
  slug: string,
  patch: { name?: string; short?: string; blurb?: string },
): Promise<Category> {
  return mutate((db) => {
    const category = db.categories.find((c) => c.slug === slug);
    if (!category) throw new DbError("Category not found", "not_found");
    if (patch.name !== undefined) category.name = patch.name.trim();
    if (patch.short !== undefined) category.short = patch.short.trim();
    if (patch.blurb !== undefined) category.blurb = patch.blurb.trim();
    return { ...category };
  });
}

export async function removeCategory(slug: string): Promise<void> {
  await mutate((db) => {
    const used = db.products.some(
      (p) => p.category === slug && p.dbStatus !== "deleted",
    );
    if (used) {
      throw new DbError(
        "Category still has products — move or delete them first",
        "in_use",
      );
    }
    const idx = db.categories.findIndex((c) => c.slug === slug);
    if (idx === -1) throw new DbError("Category not found", "not_found");
    db.categories.splice(idx, 1);
  });
}

/* ------------------------------ users ------------------------------ */

export function publicUsers(): PublicUser[] {
  return getDb().users.map(toPublic);
}

export function findUserByEmail(email: string): StoredUser | undefined {
  const needle = email.trim().toLowerCase();
  return getDb().users.find((u) => u.email.toLowerCase() === needle);
}

export function findUserById(id: string): StoredUser | undefined {
  return getDb().users.find((u) => u.id === id);
}

export async function createUser(input: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: "customer" | "admin";
}): Promise<PublicUser> {
  return mutate((db) => {
    const email = input.email.trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new DbError("An account with this email already exists", "conflict");
    }
    const pw = hashPassword(input.password);
    const user: StoredUser = {
      id: `usr_${randomBytes(6).toString("hex")}`,
      name: input.name.trim(),
      email,
      phone: input.phone?.trim() || undefined,
      role: input.role ?? "customer",
      addresses: [],
      createdAt: new Date().toISOString(),
      passwordSalt: pw.salt,
      passwordHash: pw.hash,
    };
    db.users.push(user);
    return toPublic(user);
  });
}

export async function updateUserAddresses(
  userId: string,
  addresses: AddressBookAddress[],
): Promise<PublicUser> {
  return mutate((db) => {
    const user = db.users.find((u) => u.id === userId);
    if (!user) throw new DbError("User not found", "not_found");
    user.addresses = addresses;
    return toPublic(user);
  });
}

function toPublic(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    addresses: user.addresses,
    createdAt: user.createdAt,
  };
}

/* ------------------------------ sessions ------------------------------ */

export function createSession(userId: string): string {
  const db = getDb();
  const token = randomBytes(24).toString("hex");
  db.sessions[token] = {
    userId,
    expires: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
  persist(db);
  return token;
}

export function destroySession(token: string): void {
  const db = getDb();
  delete db.sessions[token];
  persist(db);
}

export function userForSession(token: string): PublicUser | undefined {
  const db = getDb();
  const entry = db.sessions[token];
  if (!entry) return undefined;
  if (new Date(entry.expires).getTime() < Date.now()) {
    destroySession(token);
    return undefined;
  }
  const user = db.users.find((u) => u.id === entry.userId);
  return user ? toPublic(user) : undefined;
}

/* ------------------------------ orders ------------------------------ */

export function allOrders(): Order[] {
  return getDb()
    .orders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ordersForUser(userId: string): Order[] {
  return allOrders().filter((o) => o.userId === userId);
}

export async function addOrder(order: Order): Promise<Order> {
  return mutate((db) => {
    db.orders.unshift(order);
    return order;
  });
}

export async function setOrderFulfilment(
  orderId: string,
  status: FulfilmentStatus,
): Promise<Order> {
  return mutate((db) => {
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) throw new DbError("Order not found", "not_found");
    order.fulfilment = status;
    if (status === "cancelled") {
      order.status = "cancelled";
      order.paymentStatus = "pending";
    }
    order.updatedAt = new Date().toISOString();
    return { ...order, items: order.items.map((i) => ({ ...i })) };
  });
}

export function findOrderById(orderId: string): Order | undefined {
  return getDb().orders.find((o) => o.id === orderId);
}

/**
 * Confirm a Razorpay payment (signature verified by the calling route).
 * Cross-checks the paid amount against the stored order total so a payment
 * for the wrong amount can never mark an order paid.
 */
export async function confirmPayment(input: {
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  amountPaise: number;
  /** Client order id — cross-checked so a payment can't confirm another order. */
  orderId?: string;
}): Promise<{ ok: boolean; error?: string; order?: Order }> {
  return mutate((db) => {
    const order = db.orders.find((o) => o.razorpayOrderId === input.razorpayOrderId);
    if (!order) return { ok: false, error: "Order not found" };
    if (input.orderId && order.id !== input.orderId) {
      return { ok: false, error: "Order does not match this payment" };
    }
    if (order.paymentStatus === "paid") {
      return { ok: true, order }; // idempotent
    }
    if (Math.round(order.total * 100) !== Math.round(input.amountPaise)) {
      return { ok: false, error: "Payment amount does not match the order" };
    }
    order.paymentStatus = "paid";
    order.status = "paid";
    if (input.razorpayPaymentId) order.razorpayPaymentId = input.razorpayPaymentId;
    order.updatedAt = new Date().toISOString();
    return { ok: true, order };
  });
}

/* ------------------------------ media ------------------------------ */

const MEDIA_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

export function saveMedia(buffer: Buffer, ext: string): string {
  const clean = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!MEDIA_EXT.has(clean)) throw new DbError("Unsupported image type", "invalid");
  ensureDirs();
  const filename = `${randomBytes(8).toString("hex")}.${clean === "jpeg" ? "jpg" : clean}`;
  writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
  return `/api/media/${filename}`;
}

export function mediaPath(filename: string): string {
  const safe = path.basename(filename); // strip any traversal
  return path.join(UPLOADS_DIR, safe);
}

/** Credentials for the demo admin login hint. */
export const DEMO_ADMIN = { email: ADMIN_EMAIL, password: ADMIN_PASSWORD };
