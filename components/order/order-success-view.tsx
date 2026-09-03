"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Package,
  PartyPopper,
  Truck,
} from "lucide-react";
import { ORDERS_KEY } from "@/lib/client-store";
import { useLocalValue } from "@/lib/client-hooks";
import { trackPurchase } from "@/lib/analytics";
import { ButtonLink, EmptyState } from "@/components/ui";
import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";

function StatusPill({ order }: { order: Order }) {
  if (order.paymentMethod === "cod") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4c7a4f]/15 px-3 py-1 text-xs font-bold text-[#3f6b43]">
        <Banknote size={13} /> Cash on Delivery
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4c7a4f]/15 px-3 py-1 text-xs font-bold text-[#3f6b43]">
      <BadgeCheck size={13} /> Paid
    </span>
  );
}

export function OrderSuccessView({ id }: { id: string }) {
  const orders = useLocalValue<Order[]>(ORDERS_KEY, []);

  const order = useMemo(() => {
    if (!id) return null;
    return orders.find((o) => o.id === id) ?? null;
  }, [id, orders]);

  // Purchase fires ONLY after the order exists and was confirmed server-side —
  // never on the "Place Order" click. Guarded per order via sessionStorage so
  // refreshes of the confirmation page don't double-report.
  useEffect(() => {
    if (!order) return;
    try {
      if (window.sessionStorage.getItem(`ambika.purchase.${order.id}`)) return;
      trackPurchase({
        transactionId: order.id,
        value: order.total,
        contentIds: order.items.map((i) => i.slug),
      });
      window.sessionStorage.setItem(`ambika.purchase.${order.id}`, "1");
    } catch {
      /* ignore */
    }
  }, [order]);

  if (order === null) {
    return (
      <EmptyState
        icon={<Package size={30} />}
        title="We couldn't find that order"
        body="If you just placed an order on this device, it should appear here automatically. Otherwise, check the order link from your confirmation."
        action={
          <ButtonLink href="/sarees" variant="outline">
            Continue Shopping
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-ink via-[#6a3d15] to-accent px-6 py-10 text-center text-[#f6ebd9] sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f6ebd9]/15 ring-1 ring-[#f6ebd9]/30">
          <PartyPopper size={28} className="text-[#e8d5b4]" />
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">
          Order confirmed!
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#e2c9a6]">
          Thank you — your sarees are being carefully packed. A summary is below.
        </p>
        <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-2">
          <span className="rounded-full border border-[#f6ebd9]/25 bg-[#f6ebd9]/10 px-4 py-1.5 font-mono text-sm tracking-wider">
            {order.number}
          </span>
          <StatusPill order={order} />
        </div>
        <p className="mt-3 text-xs text-[#c9a27a]">
          Order placed {formatDate(order.createdAt)} · Stored on this device
          (demo)
        </p>
      </div>

      <div className="space-y-6 p-6 sm:p-8">
        {/* Delivery estimate */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-bronze/40 bg-bronze/10 px-5 py-4">
          <p className="flex items-center gap-2.5 text-sm font-bold text-ink">
            <Truck size={19} className="text-bronze" />
            Estimated delivery by {formatDate(order.estimatedDelivery)}
          </p>
          <p className="text-xs text-ink2">3–5 working days · Usually earlier</p>
        </div>

        {/* Items */}
        <section>
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-muted">
            Items · {order.items.length}
          </h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {order.items.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex items-center gap-4 p-4">
                <div className="h-16 w-13 shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
                  <SareeArt
                    spec={artForProduct(item.slug, item.color, "")}
                    crop="portrait"
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/sarees/${item.slug}`}
                    className="line-clamp-2 text-sm font-semibold text-ink hover:text-accent"
                  >
                    {item.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {item.color} · Qty {item.qty}
                  </p>
                </div>
                <p className="font-display text-lg font-bold text-ink">
                  {formatINR(item.price * item.qty)}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Address */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-line p-5">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted">
              <MapPin size={14} className="text-bronze" /> Delivering to
            </p>
            <address className="mt-3 text-sm not-italic leading-6 text-ink2">
              <p className="font-bold text-ink">{order.address.fullName}</p>
              <p>
                {order.address.line1}
                {order.address.landmark ? `, ${order.address.landmark}` : ""}
              </p>
              <p>
                {order.address.city}, {order.address.state} —{" "}
                {order.address.pincode}
              </p>
              <p className="mt-1 text-ink2">{order.address.phone}</p>
            </address>
          </div>
          <div className="rounded-2xl border border-line p-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Payment
            </p>
            <p className="mt-3 text-sm font-semibold text-ink">
              {order.paymentMethod === "cod"
                ? "Cash on Delivery"
                : order.paymentMethod === "upi"
                  ? "UPI"
                  : order.paymentMethod === "card"
                    ? "Credit / Debit Card"
                    : "Net Banking"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {order.paymentMethod === "cod"
                ? "Pay the delivery partner in cash."
                : "Payment verified. A receipt is included in your order."}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#3f6b43]">
              <CheckCircle2 size={15} />
              {order.paymentMethod === "cod" ? "Order accepted" : "Payment confirmed"}
            </div>
          </div>
        </section>

        {/* Totals */}
        <dl className="space-y-2 rounded-2xl border border-line bg-bg/60 p-5 text-sm">
          <div className="flex justify-between text-ink2">
            <dt>Subtotal</dt>
            <dd>{formatINR(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-ink2">
            <dt>Shipping</dt>
            <dd>{order.shipping === 0 ? "Free" : formatINR(order.shipping)}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3">
            <dt className="font-bold text-ink">Total paid</dt>
            <dd className="font-display text-2xl font-bold text-ink">
              {formatINR(order.total)}
            </dd>
          </div>
        </dl>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href="/account" variant="outline" className="flex-1">
            View My Orders <ChevronRight size={16} />
          </ButtonLink>
          <ButtonLink href="/sarees" className="flex-1">
            Continue Shopping
          </ButtonLink>
        </div>
        <p className="text-center text-xs leading-5 text-muted">
          Questions about your order? Write to us at{" "}
          <a className="text-accent underline" href="mailto:hello@ambikasarees.in">
            hello@ambikasarees.in
          </a>{" "}
          or WhatsApp us on +91 98765 43210.
        </p>
      </div>
    </div>
  );
}
