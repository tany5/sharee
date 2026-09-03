"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  IndianRupee,
  Loader2,
  Package,
  PackageOpen,
  RefreshCw,
  ShoppingBag,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { StatCard, StatusChip, formatINRShort } from "@/components/admin/shared";
import type { FulfilmentStatus } from "@/lib/types";

interface Summary {
  ordersCount: number;
  revenue: number;
  subtotalRevenue: number;
  shippingCollected: number;
  cogs: number;
  grossProfit: number;
  marginPct: number;
  itemsSold: number;
  customersCount: number;
  fulfilmentCounts: Record<FulfilmentStatus, number>;
  topProducts: { name: string; qty: number; revenue: number }[];
  recentOrders: {
    id: string;
    number: string;
    customer: string;
    total: number;
    fulfilment: FulfilmentStatus;
    createdAt: string;
  }[];
}

function dateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function FulfilmentBar({
  counts,
  total,
}: {
  counts: Summary["fulfilmentCounts"];
  total: number;
}) {
  const segments: { key: FulfilmentStatus; color: string }[] = [
    { key: "pending", color: "bg-[#b3922f]" },
    { key: "dispatched", color: "bg-[#2c5f8a]" },
    { key: "completed", color: "bg-[#4c7a4f]" },
    { key: "cancelled", color: "bg-[#9d9d9d]" },
  ];
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface2">
        {segments.map((s) => {
          const n = counts[s.key] ?? 0;
          if (n === 0) return null;
          return (
            <div
              key={s.key}
              className={s.color}
              style={{ width: `${(n / Math.max(total, 1)) * 100}%` }}
              title={`${s.key}: ${n}`}
            />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
        {segments.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs text-ink2">
            <span className={`h-2 w-2 rounded-full ${s.color}`} aria-hidden />
            {s.key === "pending"
              ? "Pending"
              : s.key.charAt(0).toUpperCase() + s.key.slice(1)}{" "}
            · <strong className="text-ink">{counts[s.key]}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetches the summary and resolves to it (state is applied by the caller).
  const requestSummary = () =>
    fetch("/api/admin/summary", { cache: "no-store" }).then(
      (r) => r.json() as Promise<{ ok: boolean; summary?: Summary; error?: string }>,
    );

  // Initial load — state updates run in the promise callbacks.
  useEffect(() => {
    let active = true;
    requestSummary()
      .then((d) => {
        if (!active) return;
        if (!d.ok || !d.summary) throw new Error(d.error ?? "Failed to load");
        setData(d.summary);
        setError(null);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Manual refresh (button click) — repeats the same fetch.
  const load = () => {
    setLoading(true);
    requestSummary()
      .then((d) => {
        if (!d.ok || !d.summary) throw new Error(d.error ?? "Failed to load");
        setData(d.summary);
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  };

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-8 w-56 animate-pulse rounded-full bg-surface2" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Loader2 size={26} className="animate-spin" />}
        title="Could not load the dashboard"
        body={error ?? "Something went wrong."}
        action={
          <Button onClick={load}>
            <RefreshCw size={15} /> Try again
          </Button>
        }
      />
    );
  }

  const fulfilmentTotal = Object.values(data.fulfilmentCounts).reduce((s, n) => s + n, 0);
  const avgOrder = data.ordersCount > 0 ? data.revenue / data.ordersCount : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-ink sm:text-3xl">Dashboard</h1>
          <p className="mt-1 text-sm text-ink2">
            Sales, costs and fulfilment at a glance.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatINRShort(data.revenue)}
          sub={`${data.ordersCount} orders · ${data.itemsSold} sarees`}
        />
        <StatCard
          label="Gross profit"
          value={formatINRShort(data.grossProfit)}
          sub={`${formatINRShort(data.marginPct === 0 ? data.cogs : data.cogs)} cost of goods`}
          accent
        />
        <StatCard
          label="Margin"
          value={`${data.marginPct}%`}
          sub={`on ${formatINRShort(data.subtotalRevenue)} of goods sold`}
          accent
        />
        <StatCard
          label="Customers"
          value={String(data.customersCount)}
          sub={`Avg order ${formatINRShort(avgOrder)}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Fulfilment + top products */}
        <div className="space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <ShoppingBag size={17} className="text-bronze" />
              <h2 className="text-lg text-ink">Order pipeline</h2>
              <span className="ml-auto text-xs text-muted">
                {fulfilmentTotal} total · {data.fulfilmentCounts.pending} awaiting dispatch
              </span>
            </div>
            <FulfilmentBar counts={data.fulfilmentCounts} total={fulfilmentTotal} />
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <div className="mb-4 flex items-center gap-2">
              <TrendingUp size={17} className="text-bronze" />
              <h2 className="text-lg text-ink">Top sellers</h2>
              <Link
                href="/admin/products"
                className="ml-auto flex items-center gap-1 text-xs font-bold text-accent hover:underline"
              >
                Manage products <ArrowRight size={13} />
              </Link>
            </div>
            {data.topProducts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
                No sales yet — products you sell will rank here by units.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {data.topProducts.map((p, i) => (
                  <li key={p.name} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-6 font-display text-base font-bold text-bronze">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                      {p.name}
                    </span>
                    <span className="shrink-0 text-xs text-muted">
                      {p.qty} sold · {formatINRShort(p.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Recent orders */}
        <section className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <Package size={17} className="text-bronze" />
            <h2 className="text-lg text-ink">Recent orders</h2>
            <Link
              href="/admin/orders"
              className="ml-auto flex items-center gap-1 text-xs font-bold text-accent hover:underline"
            >
              All <ArrowRight size={13} />
            </Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <EmptyState
              icon={<PackageOpen size={26} />}
              title="No orders yet"
              body="New orders land here the moment they are placed from the store."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[13px] font-bold text-ink">{o.number}</p>
                    <p className="truncate text-xs text-muted">
                      {o.customer} · {dateShort(o.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink">{formatINRShort(o.total)}</p>
                    <StatusChip status={o.fulfilment ?? "pending"} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
            <div>
              <p className="flex items-center justify-center gap-1 text-base font-bold text-ink">
                <IndianRupee size={13} className="text-bronze" />{" "}
                {formatINRShort(data.shippingCollected)}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Shipping
              </p>
            </div>
            <div>
              <p className="text-base font-bold text-ink">{data.ordersCount}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Orders</p>
            </div>
            <div>
              <p className="text-base font-bold text-ink">{data.itemsSold}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Sarees sold
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Quick actions */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/admin/products/new", label: "Add a saree", icon: Package },
          { href: "/admin/orders", label: "Dispatch orders", icon: ShoppingBag },
          { href: "/admin/categories", label: "Categories", icon: Users },
          { href: "/admin/customers", label: "Customers", icon: Users },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm font-bold text-ink transition-colors hover:border-accent/40 hover:bg-accent/5"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/12 text-accent">
              <q.icon size={16} />
            </span>
            {q.label}
            <ArrowRight
              size={15}
              className="ml-auto text-muted transition-transform group-hover:translate-x-0.5"
            />
          </Link>
        ))}
      </section>
    </div>
  );
}
