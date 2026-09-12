"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CreditCard,
  Headset,
  PackageX,
  RotateCcw,
  ShieldQuestion,
  ShoppingBag,
} from "lucide-react";
import { getOrderById } from "@/lib/client-store";
import { ButtonLink, Button, EmptyState } from "@/components/ui";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { Order } from "@/lib/types";

/**
 * Payment-failure page.
 *
 * Shown when a Razorpay payment was attempted but did not complete, or when
 * the client-side verification could not confirm it. Before showing the
 * failure state it checks the server: if a webhook already confirmed the
 * payment (order flipped to paid after a verify hiccup), it forwards to the
 * order-success page instead — a customer should never see "payment failed"
 * for an order that actually went through.
 */
export function OrderFailureView({ id }: { id: string }) {
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [checking, setChecking] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        if (!cancelled) setChecking(false);
        return;
      }

      // Local copy first (guest orders are stored on the device).
      const local = getOrderById(id);
      if (local) {
        // Already paid (e.g. webhook landed before this page loaded) → success.
        if (local.paymentStatus === "paid" || local.paymentStatus === "cod") {
          if (!cancelled) router.replace(`/order-success?order=${encodeURIComponent(id)}`);
          return;
        }
        if (!cancelled) {
          setOrder(local);
          setChecking(false);
        }
        return;
      }

      // Not local (signed-in orders live on the server): ask the server.
      try {
        const res = await fetch(`/api/orders/status?order=${encodeURIComponent(id)}`);
        const data = (await res.json()) as {
          ok: boolean;
          notFound?: boolean;
          status?: { paymentStatus: string; total: number; number: string };
        };
        if (cancelled) return;
        if (!res.ok || !data.ok || !data.status) {
          setNotFound(data.notFound ?? true);
          setChecking(false);
          return;
        }
        if (data.status.paymentStatus === "paid") {
          router.replace(`/order-success?order=${encodeURIComponent(id)}`);
          return;
        }
        // Server copy exists but is pending — show failure with what we know.
        setOrder({
          id,
          number: data.status.number,
          total: data.status.total,
          paymentStatus: data.status.paymentStatus as Order["paymentStatus"],
          items: [],
          subtotal: 0,
          shipping: 0,
          paymentMethod: "upi",
          status: "placed",
          address: { fullName: "", phone: "", pincode: "", line1: "", city: "", state: "" },
          createdAt: new Date().toISOString(),
          estimatedDelivery: new Date().toISOString(),
          fulfilment: "pending",
          storedIn: "local",
        } as Order);
        setChecking(false);
      } catch {
        if (!cancelled) {
          setNotFound(false);
          setChecking(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  const isPaid =
    order?.paymentStatus === "paid" ||
    order?.paymentStatus === "cod";

  if (checking) {
    return (
      <EmptyState
        icon={<ShieldQuestion size={30} />}
        title="Checking your payment…"
        body="One moment while we confirm the status of your payment."
      />
    );
  }

  if (isPaid) {
    return (
      <EmptyState
        icon={<ShoppingBag size={30} />}
        title="Your payment went through!"
        body="Redirecting you to your order confirmation…"
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#5a2a20] via-[#6e3325] to-[#8a4a2f] px-6 py-10 text-center text-[#f6ebd9] sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6ebd9]/15 ring-1 ring-[#f6ebd9]/30">
          <CircleAlert size={28} className="text-[#f3c3a8]" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          Payment not completed
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#e2c9a6]">
          No money was taken. Your order is safe — you can retry the payment or
          reach out to us and we&apos;ll help you finish it.
        </p>
        {order?.number && (
          <span className="mt-5 inline-flex rounded-full border border-[#f6ebd9]/25 bg-[#f6ebd9]/10 px-4 py-1.5 font-mono text-sm tracking-wider">
            {order.number}
          </span>
        )}
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* What this means */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-danger/30 bg-danger/5 px-5 py-4">
          <p className="flex items-center gap-2.5 text-sm font-bold text-ink">
            <CreditCard size={19} className="text-danger" />
            {notFound
              ? "We couldn't find a record of this payment."
              : "Your payment did not complete."}
          </p>
          <p className="text-xs leading-5 text-ink2">
            {order?.number
              ? `Order ${order.number} is saved${
                  order.total > 0 ? ` for ${formatINR(order.total)}` : ""
                }. The items are still reserved — retry whenever you're ready.`
              : "The items are still in your cart. Retry the payment whenever you're ready."}
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={() => router.push("/checkout")}
          >
            <RotateCcw size={17} /> Retry Payment
          </Button>
          <ButtonLink
            href="/sarees"
            variant="outline"
            className="flex-1"
          >
            Continue Shopping
          </ButtonLink>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted">
              <Headset size={14} className="text-bronze" /> Need help?
            </p>
            <p className="mt-2 text-sm leading-6 text-ink2">
              Write to us at{" "}
              <a className="text-accent underline" href={`mailto:${SITE.email}`}>
                {SITE.email}
              </a>{" "}
              or WhatsApp {SITE.phone} — we&apos;ll finish your order for you.
            </p>
          </div>
          <div className="rounded-2xl border border-line p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted">
              <PackageX size={14} className="text-bronze" /> Worried about a deduction?
            </p>
            <p className="mt-2 text-sm leading-6 text-ink2">
              If money was debited but the payment shows failed, it is
              auto-refunded by your bank within 5–7 working days. We can also
              check on it for you.
            </p>
          </div>
        </div>

        <p className="text-center text-xs leading-5 text-muted">
          <Link href="/sarees" className="text-accent underline">
            Browse more sarees
          </Link>{" "}
          — every saree is just ₹199 with easy returns.
        </p>
      </div>
    </div>
  );
}
