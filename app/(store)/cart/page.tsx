import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Your Cart",
  description:
    "Review your sarees, adjust quantities and proceed to a fast, guest-friendly checkout. Every saree is ₹199.",
  path: "/cart",
});

export default function CartPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl text-ink sm:text-4xl">Your Cart</h1>
      <p className="mt-1.5 text-sm text-ink2">
        Every saree is ₹199 — no hidden costs, prices include all taxes.
      </p>
      <div className="mt-8">
        <CartView />
      </div>
    </div>
  );
}
