"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, MapPin, Search, Users } from "lucide-react";
import { EmptyState, TextInput } from "@/components/ui";
import { PageHeader, formatINRShort } from "@/components/admin/shared";
import type { AddressBookAddress } from "@/lib/types";
import { formatDate, formatINR } from "@/lib/format";
import { cx } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  addresses: AddressBookAddress[];
  createdAt: string;
  ordersCount: number;
  totalSpend: number;
}

export function AdminCustomers() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/customers", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; customers?: Customer[]; error?: string }>)
      .then((d) => {
        if (!d.ok) throw new Error(d.error ?? "Failed to load customers");
        setCustomers(d.customers ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const filtered = useMemo(() => {
    if (!customers) return null;
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q),
    );
  }, [customers, query]);

  const totalSpend = customers?.reduce((s, c) => s + c.totalSpend, 0) ?? 0;
  const withOrders = customers?.filter((c) => c.ordersCount > 0).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Customers"
        sub={
          customers
            ? `${customers.length} registered · ${withOrders} with orders · lifetime ${formatINRShort(totalSpend)}`
            : ""
        }
      />

      <div className="relative mb-4 max-w-md">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or phone…"
          className="pl-9"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {filtered === null ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title={customers?.length ? "No matching customers" : "No customers yet"}
          body={
            customers?.length
              ? "Try another search term."
              : "Shoppers who create an account on the store will appear here with their orders and spend."
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((c) => {
            const initial = (c.name || "?").slice(0, 1).toUpperCase();
            const open = openId === c.id;
            return (
              <li key={c.id} className="rounded-2xl border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left sm:px-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink font-display text-lg font-bold text-btntext">
                    {initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{c.name}</p>
                    <p className="truncate text-xs text-muted">
                      {c.email}
                      {c.phone ? ` · ${c.phone}` : ""} · joined {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4 text-right sm:gap-6">
                    <div>
                      <p className="text-sm font-bold text-ink">{c.ordersCount}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        Orders
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-bronze">
                        {formatINR(c.totalSpend)}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                        Spent
                      </p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cx("text-muted transition-transform", open && "rotate-180")}
                    />
                  </div>
                </button>

                {open && (
                  <div className="border-t border-line px-4 py-4 sm:px-5">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted">
                      Saved addresses ({c.addresses.length})
                    </p>
                    {c.addresses.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-xs text-muted">
                        No saved addresses yet.
                      </p>
                    ) : (
                      <ul className="grid gap-3 md:grid-cols-2">
                        {c.addresses.map((a) => (
                          <li
                            key={a.id}
                            className="flex items-start gap-2.5 rounded-xl border border-line bg-bg px-3.5 py-3 text-[13px] leading-5"
                          >
                            <MapPin size={15} className="mt-0.5 shrink-0 text-bronze" />
                            <div className="min-w-0 text-ink2">
                              <p className="font-bold text-ink">
                                {a.fullName}
                                {a.isDefault && (
                                  <span className="ml-2 rounded-full bg-bronze/15 px-2 py-0.5 text-[10px] font-bold text-bronze">
                                    Default
                                  </span>
                                )}
                              </p>
                              <p>
                                {a.line1}
                                {a.landmark ? `, ${a.landmark}` : ""}, {a.city}, {a.state} —{" "}
                                {a.pincode}
                              </p>
                              <p className="text-muted">{a.phone}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
