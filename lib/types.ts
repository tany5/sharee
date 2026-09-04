/** Domain types shared across the storefront. Keep free of framework imports. */

export interface Category {
  slug: string;
  name: string;
  /** Short label used on chips/cards, e.g. "Cotton". */
  short: string;
  /** One-line editorial blurb shown on category cards. */
  blurb: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  /** Category slug, see Category. */
  category: string;
  /** Short marketing description. */
  description: string;
  /** Longer descriptive paragraph(s) used on the product page. */
  details: string;
  fabric: string;
  occasion: string;
  /** Display colour name (first of `colors`). */
  colorway: string;
  /** Colour variants shown in the PDP colour selector. */
  colors: string[];
  /** Inclusive price in INR (₹199 default for the whole catalogue). */
  price: number;
  /** Optional higher "was" price. */
  compareAt?: number;
  stock: number;
  rating: number;
  reviewCount: number;
  /** Flags: "bestseller" | "new" — drives home page sections. */
  tags: string[];
  featured: boolean;
  /** ISO date, drives "Newest" sorting. */
  createdAt: string;
  /** Admin-managed fields (present on demo-DB rows). */
  cost?: number;
  images?: string[];
  updatedAt?: string;
}

export interface CartItem {
  slug: string;
  qty: number;
  color: string;
  /** Snapshot captured at add-time so admin-edited / new products render correctly. */
  name?: string;
  price?: number;
}

export type PaymentMethodId = "upi" | "card" | "netbanking" | "cod";

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  pincode: string;
  line1: string;
  landmark?: string;
  city: string;
  state: string;
}

/** Full address-book entry (customer accounts). */
export interface AddressBookAddress extends DeliveryAddress {
  id: string;
  label?: string;
  isDefault: boolean;
  createdAt: string;
}

export type OrderStatus = "placed" | "paid" | "cod" | "cancelled";
export type PaymentStatus = "paid" | "pending" | "cod";
/** Fulfilment pipeline managed in the admin panel. */
export type FulfilmentStatus = "pending" | "dispatched" | "completed" | "cancelled";

export interface OrderItem {
  slug: string;
  name: string;
  qty: number;
  /** Unit price in INR at the time of ordering. */
  price: number;
  color: string;
  /** Unit cost snapshot at the time of ordering (admin profit math). */
  cost?: number;
}

export interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  fbclid?: string;
}

export interface Order {
  id: string;
  /** Human friendly number, e.g. AMB-260903-0042 */
  number: string;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  total: number;
  paymentMethod: PaymentMethodId;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  /** Razorpay payment-order id (set when the order is created against Razorpay). */
  razorpayOrderId?: string;
  /** Razorpay payment id (set once the payment is verified/confirmed). */
  razorpayPaymentId?: string;
  address: DeliveryAddress;
  utm?: Utm;
  /** Demo only: where the order record is stored locally. */
  storedIn: "local";
  createdAt: string;
  estimatedDelivery: string;
  /** Admin/fulfilment fields (present once persisted to the demo DB). */
  fulfilment?: FulfilmentStatus;
  userId?: string;
  userEmail?: string;
  updatedAt?: string;
}

export interface CategoryWithCount extends Category {
  count: number;
}

export type UserRole = "customer" | "admin";

/** Catalogue lifecycle managed from the admin panel. */
export type DbStatus = "active" | "draft" | "deleted";

/** A user profile as seen by the client (no credentials, no hashes). */
export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  addresses: AddressBookAddress[];
  createdAt: string;
}
