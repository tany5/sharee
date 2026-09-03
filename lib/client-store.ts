/**
 * localStorage persistence for the demo cart, wishlist and orders.
 * Every access is guarded (SSR, private mode, quota errors) and versioned.
 */
import type { Order } from "@/lib/types";

export const CART_KEY = "ambika.cart.v1";
export const WISHLIST_KEY = "ambika.wishlist.v1";
export const ORDERS_KEY = "ambika.orders.v1";
export const THEME_KEY = "ambika.theme";

export function safeGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ------------------------------- Orders ------------------------------- */

export function saveOrder(order: Order): void {
  const orders = getOrders();
  orders.unshift(order);
  safeSet(ORDERS_KEY, orders.slice(0, 50));
}

export function getOrders(): Order[] {
  return safeGet<Order[]>(ORDERS_KEY) ?? [];
}

export function getOrderById(id: string): Order | undefined {
  return getOrders().find((o) => o.id === id);
}
