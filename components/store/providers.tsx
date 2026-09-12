"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/types";
import {
  addItemToCart,
  cartCount,
  removeItem,
  setItemQty,
  MAX_QTY_PER_ITEM,
} from "@/lib/cart";
import { CART_KEY, WISHLIST_KEY, safeGet } from "@/lib/client-store";
import { commitLocalValue, useLocalValue } from "@/lib/client-hooks";

interface CartValue {
  items: CartItem[];
  count: number;
  add: (
    slug: string,
    color: string,
    qty?: number,
    meta?: { name?: string; price?: number; image?: string },
  ) => void;
  setQty: (slug: string, color: string, qty: number) => void;
  remove: (slug: string, color: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function snapshotCart(): CartItem[] {
  return safeGet<CartItem[]>(CART_KEY) ?? [];
}

interface WishlistValue {
  slugs: string[];
  has: (slug: string) => boolean;
  toggle: (slug: string) => void;
  count: number;
}

const WishlistContext = createContext<WishlistValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const items = useLocalValue<CartItem[]>(CART_KEY, []);
  const slugs = useLocalValue<string[]>(WISHLIST_KEY, []);

  const add = useCallback(
    (slug: string, color: string, qty = 1, meta?: { name?: string; price?: number; image?: string }) => {
      commitLocalValue(
        CART_KEY,
        addItemToCart(snapshotCart(), {
          slug,
          color,
          qty: Math.max(1, Math.min(qty, MAX_QTY_PER_ITEM)),
          name: meta?.name,
          price: meta?.price,
          image: meta?.image,
        }),
      );
    },
    [],
  );

  const setQty = useCallback((slug: string, color: string, qty: number) => {
    commitLocalValue(CART_KEY, setItemQty(snapshotCart(), slug, color, qty));
  }, []);

  const remove = useCallback((slug: string, color: string) => {
    commitLocalValue(CART_KEY, removeItem(snapshotCart(), slug, color));
  }, []);

  const clear = useCallback(() => {
    commitLocalValue(CART_KEY, []);
  }, []);

  const toggleWish = useCallback((slug: string) => {
    const current = safeGet<string[]>(WISHLIST_KEY) ?? [];
    commitLocalValue(
      WISHLIST_KEY,
      current.includes(slug)
        ? current.filter((s) => s !== slug)
        : [...current, slug],
    );
  }, []);

  const cartValue = useMemo<CartValue>(
    () => ({
      items,
      count: cartCount(items),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, add, setQty, remove, clear],
  );

  const wishlistValue = useMemo<WishlistValue>(
    () => ({
      slugs,
      count: slugs.length,
      has: (slug) => slugs.includes(slug),
      toggle: toggleWish,
    }),
    [slugs, toggleWish],
  );

  return (
    <CartContext.Provider value={cartValue}>
      <WishlistContext.Provider value={wishlistValue}>
        {children}
      </WishlistContext.Provider>
    </CartContext.Provider>
  );
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <StoreProvider>");
  return ctx;
}

export function useWishlist(): WishlistValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <StoreProvider>");
  return ctx;
}
