"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Loader2, MapPin, Search, ShoppingBag, Wallet } from "lucide-react";
import { EmptyState, TextInput } from "@/components/ui";
import {
  FULFILMENT_LABEL,
  PageHeader,
  PAYMENT_LABEL,
  PAYMENT_STATUS_LABEL,
  StatusChip,
  formatINRShort,
} from "@/components/admin/shared";
import type { FulfilmentStatus, Order } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";
import { useToast } from "@/components/admin/toast";

type Filter = "all" | FulfilmentStatus;

const TABS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "dispatched", label: "Dispatched" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function itemProfit(order: Order): { revenue: number; cogs: number } {
  const revenue = order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const cogs = order.items.reduce((s, it) => s + (it.cost ?? 0) * it.qty, 0);
  return { revenue, cogs };
}

function OrderCard({ order, onUpdated }: { order: Order; onUpdated: () => void }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState<FulfilmentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const current = order.fulfilment ?? "pending";

  const setStatus = async (status: FulfilmentStatus) => {
    if (status === current || updating) return;
    setUpdating(status);
    setError(null);
    const res = await fetch(`/api/admin/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fulfilment: status }),
    });
    const data = (await res.json()) as { ok: boolean; order?: Order; error?: string };
    setUpdating(null);
    if (!data.ok) {
      setError(data.error ?? "Could not update the order");
      toast.error(data.error ?? "Could not update the order");
      return;
    }
    toast.success(`${order.number} marked ${FULFILMENT_LABEL[status].toLowerCase()}.`);
    onUpdated();
  };

  const profit = itemProfit(order);
  const gross = profit.revenue - profit.cogs;

  return (
    <li className="rounded-2xl border border-line bg-surface">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left sm:px-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-sm font-bold text-ink">{order.number}</p>
            {order.userEmail && (
              <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent">
                Account
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {order.userEmail ?? order.address.fullName} · {formatDate(order.createdAt)} ·{" "}
            {order.items.reduce((s, it) => s + it.qty, 0)} items
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-bold text-ink">{formatINRShort(order.total)}</p>
            <p className="text-[11px] text-muted">
              profit {gross >= 0 ? "+" : "−"}
              {formatINR(Math.abs(gross))}
            </p>
          </div>
          <StatusChip status={current} />
          <ChevronDown
            size={17}
            className={cx("text-muted transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {/* Details */}
      {open && (
        <div className="border-t border-line px-4 py-4 sm:px-5">
          <div className="grid gap-5 lg:grid-cols-3">
            {/* Items */}
            <div className="lg:col-span-2">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                Items
              </p>
              <ul className="divide-y divide-line rounded-xl border border-line bg-bg">
                {order.items.map((it, i) => {
                  const lineProfit = (it.price - (it.cost ?? 0)) * it.qty;
                  return (
                    <li key={`${it.slug}-${i}`} className="flex items-center gap-3 px-3.5 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{it.name}</p>
                        <p className="text-[11px] text-muted">
                          {it.color} · {formatINR(it.price)} × {it.qty} · cost{" "}
                          {formatINR(it.cost ?? 0)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-ink">{formatINR(it.price * it.qty)}</p>
                        <p
                          className={cx(
                            "text-[11px] font-semibold",
                            lineProfit >= 0 ? "text-[#3f6b43]" : "text-danger",
                          )}
                        >
                          {lineProfit >= 0 ? "+" : "−"}
                          {formatINR(Math.abs(lineProfit))}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="mt-2 flex items-center justify-between rounded-xl bg-bg px-3.5 py-2 text-sm">
                <span className="text-muted">Subtotal · Shipping</span>
                <span className="font-semibold text-ink">
                  {formatINR(order.subtotal)} · {order.shipping === 0 ? "Free" : formatINR(order.shipping)}
                </span>
              </div>
            </div>

            {/* Customer + fulfilment */}
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <MapPin size={12} /> Delivery
                </p>
                <div className="rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[13px] leading-5 text-ink2">
                  <p className="font-bold text-ink">{order.address.fullName}</p>
                  <p>
                    {order.address.line1}
                    {order.address.landmark ? `, ${order.address.landmark}` : ""}
                    <br />
                    {order.address.city}, {order.address.state} — {order.address.pincode}
                  </p>
                  <p className="text-muted">{order.address.phone}</p>
                </div>
              </div>

              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  <Wallet size={12} /> Payment
                </p>
                <p className="text-sm font-semibold text-ink">
                  {PAYMENT_LABEL[order.paymentMethod] ?? order.paymentMethod}
                  <span
                    className={cx(
                      "ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                      order.paymentStatus === "paid"
                        ? "bg-[#4c7a4f]/15 text-[#3f6b43]"
                        : order.paymentStatus === "cod"
                          ? "bg-[#2c5f8a]/15 text-[#22506f]"
                          : "bg-danger/15 text-danger",
                    )}
                  >
                    {PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus}
                  </span>
                </p>
                {order.paymentStatus === "cod" && (
                  <p className="mt-1 text-[11px] text-muted">
                    Collect {formatINR(order.total)} at the door.
                  </p>
                )}
                {order.paymentStatus === "pending" && (
                  <p className="mt-1 text-[11px] font-semibold text-danger">
                    Awaiting Razorpay confirmation — dispatch after the payment
                    clears.
                  </p>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                  Fulfilment
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(FULFILMENT_LABEL) as FulfilmentStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={updating !== null || order.paymentStatus === "pending"}
                      onClick={() => setStatus(s)}
                      aria-pressed={current === s}
                      className={cx(
                        "rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50",
                        current === s
                          ? "bg-ink text-btntext"
                          : "border border-line bg-bg text-ink2 hover:border-accent/50 hover:text-accent",
                      )}
                    >
                      {FULFILMENT_LABEL[s]}
                    </button>
                  ))}
                </div>
                {updating && (
                  <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted">
                    <Loader2 size={11} className="animate-spin" /> Updating…
                  </p>
                )}
                {error && (
                  <p role="alert" className="mt-1.5 text-[11px] font-semibold text-danger">
                    {error}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch("/api/admin/orders", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; orders?: Order[]; error?: string }>)
      .then((d) => {
        if (!d.ok) throw new Error(d.error ?? "Failed to load orders");
        setOrders(d.orders ?? []);
      })
      .catch((e: Error) => setError(e.message));
  };
  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!orders) return null;
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "all" && (o.fulfilment ?? "pending") !== filter) return false;
      if (!q) return true;
      return (
        o.number.toLowerCase().includes(q) ||
        (o.userEmail ?? "").toLowerCase().includes(q) ||
        o.address.fullName.toLowerCase().includes(q) ||
        o.address.phone.includes(q)
      );
    });
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: orders?.length ?? 0, pending: 0, dispatched: 0, completed: 0, cancelled: 0 };
    for (const o of orders ?? []) c[o.fulfilment ?? "pending"] += 1;
    return c;
  }, [orders]);

  return (
    <div>
      <PageHeader
        title="Orders"
        sub={orders ? `${orders.length} orders placed from the store` : ""}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setFilter(t.value)}
              className={cx(
                "rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors",
                filter === t.value
                  ? "bg-ink text-btntext"
                  : "border border-line bg-surface text-ink2 hover:text-accent",
              )}
            >
              {t.label}
              <span className="ml-1.5 text-xs opacity-70">{counts[t.value]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:ml-auto lg:w-72">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Order no., customer, phone…"
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {filtered === null ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag size={26} />}
          title={orders?.length ? "No matching orders" : "No orders yet"}
          body={
            orders?.length
              ? "Try another filter or search term."
              : "When customers place orders they'll queue here — mark them dispatched, then completed as they're delivered."
          }
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((o) => (
            <OrderCard key={o.id} order={o} onUpdated={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
