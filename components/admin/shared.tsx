"use client";

import type { FulfilmentStatus } from "@/lib/types";
import type { DbStatus } from "@/lib/demo/db";
import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";

/* ------------------------------- statuses ------------------------------- */

export const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const FULFILMENT_CHIP: Record<FulfilmentStatus, string> = {
  pending: "bg-[#b3922f]/15 text-[#7a5c14]",
  dispatched: "bg-[#2c5f8a]/15 text-[#22506f]",
  completed: "bg-[#4c7a4f]/15 text-[#3f6b43]",
  cancelled: "bg-danger/15 text-danger",
};

export function StatusChip({ status }: { status: FulfilmentStatus }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold",
        FULFILMENT_CHIP[status],
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {FULFILMENT_LABEL[status]}
    </span>
  );
}

/** Next step in the fulfilment pipeline (skips cancelled). */
export function nextFulfilment(status: FulfilmentStatus): FulfilmentStatus | null {
  if (status === "pending") return "dispatched";
  if (status === "dispatched") return "completed";
  return null;
}

export const DB_STATUS_LABEL: Record<DbStatus, string> = {
  active: "Active",
  draft: "Draft",
  deleted: "Deleted",
};

export const PAYMENT_LABEL: Record<string, string> = {
  upi: "UPI",
  card: "Card",
  netbanking: "Net Banking",
  cod: "Cash on Delivery",
};

/* ------------------------------ thumbnails ------------------------------ */

/** First uploaded photo, or the deterministic fabric artwork. */
export function AdminThumb({
  product,
  className,
}: {
  product: { slug: string; name: string; colorway: string; category: string; images?: string[] };
  className?: string;
}) {
  const image = product.images?.[0];
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={product.name}
        className={cx("h-14 w-11 shrink-0 rounded-lg border border-line object-cover", className)}
      />
    );
  }
  return (
    <div className={cx("h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-line", className)}>
      <SareeArt
        spec={artForProduct(product.slug, product.colorway, product.category)}
        label={product.name}
        crop="portrait"
        className="h-full w-full"
      />
    </div>
  );
}

export function isActiveProduct(p: { dbStatus: DbStatus }): boolean {
  return p.dbStatus === "active";
}

/* ------------------------------ stat cards ------------------------------ */

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">{label}</p>
      <p
        className={cx(
          "mt-1.5 font-display text-2xl font-bold sm:text-[1.75rem]",
          accent ? "text-bronze" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-ink2">{sub}</p>}
    </div>
  );
}

/* --------------------------- page chrome --------------------------- */

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl text-ink sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink2">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function formatINRShort(v: number): string {
  return formatINR(v);
}
