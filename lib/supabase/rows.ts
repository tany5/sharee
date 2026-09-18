/** Supabase schema row shapes + coercions (snake_case columns). */

export interface ProfileRow {
  id: string;
  role: "customer" | "admin";
  full_name: string | null;
  phone: string | null;
  addresses: unknown;
  created_at: string;
}

export interface CategoryRow {
  id: number;
  slug: string;
  name: string;
  short: string;
  blurb: string;
  created_at?: string;
}

export interface ProductRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  details: string;
  fabric: string;
  occasion: string;
  colorway: string;
  colors: unknown;
  price: number;
  compare_at: number | null;
  cost: number;
  stock: number;
  rating: number;
  review_count: number;
  tags: unknown;
  featured: boolean;
  images: unknown;
  db_status: "active" | "draft" | "deleted";
  is_custom: boolean;
  marketing: unknown;
  marketing_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  number: string;
  user_id: string | null;
  user_email: string | null;
  items: unknown;
  subtotal: number;
  shipping: number;
  total: number;
  payment_method: string;
  payment_status: string;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  cashfree_order_id: string | null;
  cashfree_payment_id: string | null;
  address: unknown;
  utm: unknown;
  fulfilment: string;
  stored_in: string;
  created_at: string;
  updated_at?: string;
  estimated_delivery: string;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStringArray = (v: unknown): string[] =>
  asArray(v).map((x) => String(x));

export const toProduct = (r: ProductRow) => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  category: r.category,
  description: r.description,
  details: r.details,
  fabric: r.fabric,
  occasion: r.occasion,
  colorway: r.colorway,
  colors: asStringArray(r.colors),
  price: Number(r.price),
  compareAt: r.compare_at == null ? undefined : Number(r.compare_at),
  stock: Number(r.stock),
  rating: Number(r.rating) || 0,
  reviewCount: Number(r.review_count) || 0,
  tags: asStringArray(r.tags),
  featured: Boolean(r.featured),
  images: asStringArray(r.images),
  cost: Number(r.cost) || 0,
  dbStatus: r.db_status,
  isCustom: Boolean(r.is_custom),
  marketing: (r.marketing ?? {}) as Record<string, unknown>,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/**
 * Map a product (partial or full) to its row. Fields left undefined stay
 * undefined so partial updates never overwrite columns the caller didn't send
 * (e.g. a dbStatus-only PATCH must not reset category/price/description).
 */
export const productToRow = (p: Record<string, unknown>) => ({
  slug: p.slug === undefined ? undefined : String(p.slug),
  name: p.name === undefined ? undefined : String(p.name),
  category: p.category === undefined ? undefined : String(p.category),
  description: p.description === undefined ? undefined : String(p.description ?? ""),
  details: p.details === undefined ? undefined : String(p.details ?? ""),
  fabric: p.fabric === undefined ? undefined : String(p.fabric ?? ""),
  occasion: p.occasion === undefined ? undefined : String(p.occasion ?? ""),
  colorway: p.colorway === undefined ? undefined : String(p.colorway ?? "Maroon"),
  colors: p.colors === undefined ? undefined : (p.colors ?? []),
  price: p.price === undefined ? undefined : Math.round(Number(p.price) || 0),
  compare_at: p.compareAt === undefined ? undefined : p.compareAt == null ? null : Math.round(Number(p.compareAt)),
  cost: p.cost === undefined ? undefined : Math.round(Number(p.cost) || 0),
  stock: p.stock === undefined ? undefined : Math.round(Number(p.stock) || 0),
  rating: p.rating === undefined ? undefined : Number(p.rating) || 0,
  review_count: p.reviewCount === undefined ? undefined : Math.round(Number(p.reviewCount) || 0),
  tags: p.tags === undefined ? undefined : (p.tags ?? []),
  featured: p.featured === undefined ? undefined : Boolean(p.featured),
  images: p.images === undefined ? undefined : (p.images ?? []),
  db_status:
    p.dbStatus === undefined
      ? undefined
      : p.dbStatus === "active"
        ? "active"
        : p.dbStatus === "deleted"
          ? "deleted"
          : "draft",
  is_custom: p.isCustom === undefined ? undefined : Boolean(p.isCustom),
  ...(p.marketing !== undefined ? { marketing: p.marketing } : {}),
});
