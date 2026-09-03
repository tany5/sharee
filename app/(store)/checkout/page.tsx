import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Checkout",
  description:
    "Fast, guest-friendly checkout for your sarees. Delivery details, UPI / cards / net banking / COD payment and a clear order summary.",
  path: "/checkout",
});

export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-3xl text-ink sm:text-4xl">Checkout</h1>
      <p className="mt-1.5 text-sm text-ink2">
        No account needed — just your delivery details and a payment method.
      </p>
      <div className="mt-8">
        <CheckoutView />
      </div>
    </div>
  );
}
