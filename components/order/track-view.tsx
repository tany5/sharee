"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  MapPin,
  MessageCircle,
  Package,
  PackageCheck,
  Printer,
  Search,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui";
import { InvoiceDocument } from "@/components/order/invoice-document";
import { SITE } from "@/lib/site";
import { courierName } from "@/lib/tracking";
import { formatDate, formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";
import type { TrackedOrder } from "@/lib/tracking";

/**
 * Public order tracking (guest path). The order number + phone pair is the
 * auth — the API only returns the customer-safe TrackedOrder projection on a
 * match, so this component can render the shipment, support and invoice
 * surfaces without any account.
 */

const STEPS = [
  { key: "placed", label: "Order placed" },
  { key: "dispatched", label: "Shipped" },
  { key: "completed", label: "Delivered" },
] as const;

function stepIndex(order: TrackedOrder): number {
  if (order.fulfilment === "completed") return 2;
  if (order.fulfilment === "dispatched") return 1;
  return 0;
}

export function TrackView({ initialNumber = "" }: { initialNumber?: string }) {
  const [number, setNumber] = useState(initialNumber);
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const lookup = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setOrder(null);
    setShowInvoice(false);
    try {
      const res = await fetch("/api/orders/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: number.trim(), phone: phone.trim() }),
      });
      const data = (await res.json()) as { ok: boolean; order?: TrackedOrder; error?: string };
      if (!data.ok || !data.order) {
        setError(data.error ?? "Could not find that order.");
        return;
      }
      setOrder(data.order);
    } catch {
      setError("Network problem — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyAwb = async (awb: string) => {
    try {
      await navigator.clipboard.writeText(awb);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — the AWB is visible anyway */
    }
  };

  const waHref = order
    ? `https://wa.me/${SITE.phone.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(
        `Hi ${SITE.name}! Asking about order ${order.number}`,
      )}`
    : "#";

  const active = order ? stepIndex(order) : -1;

  return (
    <div className="tt-print-area mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/12 text-accent">
          <Truck size={22} />
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            Track your order
          </p>
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">
            Where is my saree?
          </h1>
        </div>
      </div>

      {/* Lookup form — hidden once found (a "Track another" link brings it back) */}
      {!order && (
        <form
          onSubmit={lookup}
          className="mt-6 rounded-2xl border border-line bg-surface p-5 sm:p-6"
        >
          <p className="text-sm text-ink2">
            Enter the order number from your confirmation (looks like{" "}
            <span className="font-mono text-[13px] font-bold">AMB-260914-0042</span>) and
            the phone number you ordered with.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Order number
              </span>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="AMB-…"
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 font-mono text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Phone used at checkout
              </span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                autoComplete="tel"
                placeholder="98765 43210"
                className="h-11 w-full rounded-lg border border-line bg-bg px-3.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="mt-4 w-full sm:w-auto" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Looking up…
              </>
            ) : (
              <>
                <Search size={17} /> Track order
              </>
            )}
          </Button>
        </form>
      )}

      {order && (
        <div className="mt-6 space-y-5">
          {/* Status card */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-ink">{order.number}</p>
                <p className="mt-0.5 text-xs text-muted">
                  Placed {formatDate(order.createdAt)} · Est. delivery{" "}
                  {formatDate(order.estimatedDelivery)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setOrder(null);
                  setPhone("");
                }}
                className="text-xs font-semibold text-accent underline underline-offset-2"
              >
                Track another order
              </button>
            </div>

            {/* Timeline */}
            {order.fulfilment === "cancelled" ? (
              <p className="mt-4 rounded-xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
                This order was cancelled. If you paid online, your refund arrives in
                5–7 working days — WhatsApp us below if it hasn&apos;t.
              </p>
            ) : (
              <ol className="mt-5 grid grid-cols-3 gap-2" aria-label="Delivery progress">
                {STEPS.map((s, i) => {
                  const done = i <= active;
                  const isLast = i === STEPS.length - 1;
                  return (
                    <li key={s.key} className="relative">
                      <div
                        className={cx(
                          "flex items-center gap-2",
                          !isLast && "after:absolute after:right-[-6px] after:top-3 after:h-px after:w-3 after:bg-line",
                        )}
                      >
                        <span
                          className={cx(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                            done ? "bg-accent text-white" : "border border-line bg-bg text-muted",
                          )}
                        >
                          {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                        </span>
                        <span
                          className={cx(
                            "text-[12px] font-semibold",
                            done ? "text-ink" : "text-muted",
                          )}
                        >
                          {s.label}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Shipment */}
            {order.tracking?.awb && (
              <div className="mt-5 rounded-xl border border-line bg-bg px-4 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                      {courierName(order.tracking.courier) || "Courier"} · AWB
                    </p>
                    <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink">
                      {order.tracking.awb}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyAwb(order.tracking?.awb ?? "")}
                      className="flex h-9 items-center gap-1.5 rounded-pill border border-line bg-surface px-3 text-xs font-semibold text-ink2 transition-colors hover:text-ink"
                      aria-label="Copy tracking number"
                    >
                      {copied ? (
                        <>
                          <CheckCircle2 size={14} className="text-success" /> Copied
                        </>
                      ) : (
                        <>
                          <ClipboardCopy size={14} /> Copy
                        </>
                      )}
                    </button>
                    {order.tracking.url && (
                      <a
                        href={order.tracking.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-9 items-center rounded-pill bg-accent px-3.5 text-xs font-bold text-white transition-colors hover:bg-accent-light"
                      >
                        Track on {courierName(order.tracking.courier) || "courier site"}
                      </a>
                    )}
                  </div>
                </div>
                {!order.tracking.url && (
                  <p className="mt-2 text-[11px] leading-4 text-muted">
                    Paste the AWB above into your courier&apos;s tracking page.
                  </p>
                )}
              </div>
            )}

            {/* Support */}
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent hover:underline"
            >
              <MessageCircle size={16} />
              Questions? WhatsApp us about {order.number}
            </a>
          </section>

          {/* Invoice */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
                  Invoice · {formatINR(order.total)}
                </p>
                <p className="mt-0.5 text-[13px] text-ink2">
                  Print or save as PDF for your records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowInvoice((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-pill border border-bronze/60 px-4 text-sm font-semibold text-bronze transition-colors hover:bg-bronze/10"
              >
                <Printer size={16} />
                {showInvoice ? "Hide invoice" : "View invoice"}
              </button>
            </div>
            {showInvoice && (
              <div className="mt-5">
                <div className="mb-3 flex justify-end print:hidden">
                  <Button size="sm" onClick={() => window.print()}>
                    <Printer size={15} /> Print / Save PDF
                  </Button>
                </div>
                <InvoiceDocument order={order} />
              </div>
            )}
          </section>

          {/* Items summary */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">
              Items · {order.items.length}
            </p>
            <ul className="mt-3 divide-y divide-line">
              {order.items.map((it, i) => (
                <li key={`${it.name}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {it.name}
                    <span className="text-muted"> · {it.color} · × {it.qty}</span>
                  </span>
                  <span className="shrink-0 font-semibold text-ink">
                    {formatINR(it.price * it.qty)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <MapPin size={13} />
              Delivering to {order.address.city}, {order.address.state} {order.address.pincode}
            </p>
          </section>
        </div>
      )}

      {/* Empty-state nudge when nothing looked up yet */}
      {!order && !busy && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted">
          <Package size={13} />
          Ordered while signed in?{" "}
          <Link href="/account" className="font-semibold text-accent underline underline-offset-2">
            Your orders live in your account
          </Link>
          <PackageCheck size={13} className="hidden" />
        </p>
      )}
    </div>
  );
}
