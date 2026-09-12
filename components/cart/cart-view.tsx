"use client";

import Link from "next/link";
import {
  ArrowRight,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Truck,
} from "lucide-react";
import { PRODUCT_INDEX } from "@/lib/data/catalog";
import { summarizeCart } from "@/lib/cart";
import { SITE } from "@/lib/site";
import { useCart } from "@/components/store/providers";
import { ButtonLink, EmptyState } from "@/components/ui";
import { WornThumb } from "@/components/product/worn-image";
import { formatINR } from "@/lib/format";
import { swatchFor } from "@/lib/color-dots";

function prettySlug(slug: string): string {
  return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export function CartView() {
  const { items, setQty, remove } = useCart();

  // Keep lines whose product still exists somewhere we can name; snapshots let
  // admin-created products render even without the seed index.
  const visibleItems = items.filter(
    (i) => PRODUCT_INDEX[i.slug] || i.name,
  );
  const summary = summarizeCart(visibleItems, (l) => l.price ?? SITE.price);
  const itemCount = visibleItems.reduce((s, i) => s + i.qty, 0);

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart size={30} />}
        title="Your cart is empty"
        body="Beautiful sarees, one simple price. Add a few and they'll be waiting right here."
        action={
          <ButtonLink href="/sarees" size="lg">
            Shop All Sarees <ArrowRight size={17} />
          </ButtonLink>
        }
      />
    );
  }

  const progressToFree = Math.min(1, summary.subtotal / SITE.freeShippingThreshold);
  const remaining = SITE.freeShippingThreshold - summary.subtotal;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:items-start">
      {/* Lines */}
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {visibleItems.map((line) => {
          const meta = PRODUCT_INDEX[line.slug];
          const name = line.name ?? meta?.name ?? prettySlug(line.slug);
          const linePrice = line.price ?? SITE.price;
          return (
            <li key={`${line.slug}::${line.color}`} className="flex gap-4 p-4 sm:gap-5 sm:p-5">
              <Link
                href={`/sarees/${line.slug}`}
                className="h-24 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-line"
              >
                <WornThumb
                  slug={line.slug}
                  colorway={meta?.colorway ?? line.color}
                  category={meta?.category}
                  name={name}
                  image={line.image}
                  className="h-full w-full"
                />
              </Link>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/sarees/${line.slug}`}
                      className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink hover:text-accent"
                    >
                      {name}
                    </Link>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                      <span
                        className="inline-block h-3 w-3 rounded-full border border-line"
                        style={{ backgroundColor: swatchFor(line.color) }}
                      />
                      {line.color}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(line.slug, line.color)}
                    aria-label={`Remove ${name}`}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <div className="flex h-9 items-center rounded-full border border-line">
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.color, line.qty - 1)}
                      aria-label="Decrease quantity"
                      className="flex h-full w-9 items-center justify-center text-ink2 hover:text-ink"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-7 text-center text-sm font-bold text-ink" aria-live="polite">
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQty(line.slug, line.color, line.qty + 1)}
                      aria-label="Increase quantity"
                      disabled={line.qty >= 5}
                      className="flex h-full w-9 items-center justify-center text-ink2 hover:text-ink disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-display text-lg font-bold text-ink">
                    {formatINR(line.qty * linePrice)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}

        <li className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <Link
            href="/sarees"
            className="text-sm font-semibold text-accent underline underline-offset-4 hover:text-ink"
          >
            ← Continue shopping
          </Link>
          <p className="text-xs text-muted">
            Prices include all taxes · Free 7-day returns
          </p>
        </li>
      </ul>

      {/* Totals */}
      <aside className="rounded-2xl border border-line bg-surface p-6 lg:sticky lg:top-40">
        <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-ink">
          Cart Totals
        </h2>

        {summary.subtotal < SITE.freeShippingThreshold && (
          <div className="mt-4 rounded-xl bg-bronze/10 px-4 py-3">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-ink2">
              <Truck size={15} className="text-bronze" />
              Add {formatINR(remaining)} more for free shipping
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full bg-bronze transition-all"
                style={{ width: `${Math.round(progressToFree * 100)}%` }}
              />
            </div>
          </div>
        )}

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between text-ink2">
            <dt>Subtotal ({itemCount} item{itemCount === 1 ? "" : "s"})</dt>
            <dd className="font-semibold text-ink">{formatINR(summary.subtotal)}</dd>
          </div>
          <div className="flex justify-between text-ink2">
            <dt>Shipping</dt>
            <dd className="font-semibold text-ink">
              {summary.shipping === 0 ? (
                <span className="text-[#4c7a4f]">Free</span>
              ) : (
                formatINR(summary.shipping)
              )}
            </dd>
          </div>
          <div className="flex justify-between border-t border-line pt-3 text-base">
            <dt className="font-bold text-ink">Total</dt>
            <dd className="font-display text-2xl font-bold text-ink">
              {formatINR(summary.total)}
            </dd>
          </div>
        </dl>

        <ButtonLink href="/checkout" size="lg" className="mt-6 w-full">
          Proceed to Checkout <ArrowRight size={17} />
        </ButtonLink>
        <p className="mt-3 text-center text-[11px] text-muted">
          UPI · Cards · Net Banking · COD available
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-5 text-center">
          {[
            { Icon: ShieldCheck, t: "Secure checkout" },
            { Icon: RotateCcw, t: "7-day returns" },
            { Icon: Truck, t: "Fast delivery" },
          ].map(({ Icon, t }) => (
            <div key={t} className="flex flex-col items-center gap-1.5 text-[11px] font-semibold text-ink2">
              <Icon size={17} className="text-bronze" />
              {t}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
