/**
 * Order creation (server side). Validates requested lines against a trusted
 * product source, recomputes every amount server-side, snapshots unit cost for
 * profit reporting and returns the order payload that the client stores and
 * the success page confirms.
 *
 * The resolver defaults to the seed catalogue (tests / no demo DB); the API
 * route injects the demo DB so admin-edited prices and costs are authoritative.
 *
 * The Razorpay path (production) replaces the "pay now" step here:
 *   server creates a Razorpay Order -> client opens checkout with order_id ->
 *   signature + webhook verified -> payment_status flipped to paid.
 */
import { PRODUCTS } from "@/lib/data/catalog";
import { defaultCostFor } from "@/lib/demo/cost";
import { MAX_QTY_PER_ITEM, totalsFor } from "@/lib/cart";
import { validateAddress, type AddressErrors } from "@/lib/validations";
import type {
  CartItem,
  DeliveryAddress,
  Order,
  OrderItem,
  PaymentMethodId,
  Utm,
} from "@/lib/types";

export class OrderError extends Error {
  constructor(
    message: string,
    public fieldErrors?: AddressErrors,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

/** Trusted source of product price/cost/name/stock for a slug. */
export interface OrderSource {
  name: string;
  price: number;
  cost: number;
  stock?: number;
}

export type ProductResolver = (
  slug: string,
) => OrderSource | undefined | Promise<OrderSource | undefined>;

function seedResolver(slug: string): OrderSource | undefined {
  const p = PRODUCTS.find((x) => x.slug === slug);
  if (!p) return undefined;
  return {
    name: p.name,
    price: p.price,
    cost: defaultCostFor(p.category, p.price),
    stock: p.stock,
  };
}

export interface CreateOrderInput {
  items: CartItem[];
  address: Partial<DeliveryAddress>;
  paymentMethod: PaymentMethodId;
  utm?: Utm;
  /** Override product lookup (demo DB with admin pricing). */
  resolveProduct?: ProductResolver;
  /** Signed-in user at checkout (persists orders to their history). */
  user?: { id: string; email: string };
}

const PAYMENT_METHODS = new Set<PaymentMethodId>([
  "upi",
  "card",
  "netbanking",
  "cod",
]);

function orderNumber(): string {
  const d = new Date();
  const ymd = [
    d.getFullYear().toString().slice(2),
    (d.getMonth() + 1).toString().padStart(2, "0"),
    d.getDate().toString().padStart(2, "0"),
  ].join("");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AMB-${ymd}-${rand}`;
}

function estimatedDelivery(createdAt: string): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 4);
  return d.toISOString();
}

export async function createDemoOrder(input: CreateOrderInput): Promise<Order> {
  if (!PAYMENT_METHODS.has(input.paymentMethod)) {
    throw new OrderError("Please choose a payment method");
  }

  const addressCheck = validateAddress(input.address);
  if (!addressCheck.ok || !addressCheck.address) {
    throw new OrderError("Please check your delivery details", addressCheck.errors);
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new OrderError("Your cart is empty");
  }
  if (input.items.length > 30) {
    throw new OrderError("Too many items in one order");
  }

  const resolver = input.resolveProduct ?? seedResolver;

  // Resolve against the trusted source — never the browser.
  const items: OrderItem[] = [];
  for (const line of input.items) {
    const source = await resolver(line.slug);
    if (!source) throw new OrderError("Item is no longer available");
    const qty = Math.round(Number(line.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new OrderError(`Invalid quantity for ${source.name}`);
    }
    items.push({
      slug: line.slug,
      name: source.name,
      qty,
      price: source.price,
      cost: source.cost,
      color: String(line.color).slice(0, 40) || "Default",
    });
  }

  // Enforce stock server-side (per-product totals across lines).
  const bySlug = new Map<string, number>();
  for (const it of items) bySlug.set(it.slug, (bySlug.get(it.slug) ?? 0) + it.qty);
  for (const [slug, qty] of bySlug) {
    const source = await resolver(slug);
    const cap = source?.stock ?? 50;
    if (qty > cap) {
      throw new OrderError(`Only ${cap} of "${source?.name ?? "this saree"}" left — reduce the quantity`);
    }
  }

  const subtotal = items.reduce((sum, it) => sum + it.price * it.qty, 0);
  const totals = totalsFor(subtotal);
  const createdAt = new Date().toISOString();

  return {
    id: `ord_${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36).padStart(3, "0")}`,
    number: orderNumber(),
    items,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    total: totals.total,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentMethod === "cod" ? "cod" : "paid",
    status: input.paymentMethod === "cod" ? "cod" : "paid",
    address: addressCheck.address,
    utm: input.utm,
    storedIn: "local",
    createdAt,
    estimatedDelivery: estimatedDelivery(createdAt),
    fulfilment: "pending",
    userId: input.user?.id,
    userEmail: input.user?.email,
  };
}
