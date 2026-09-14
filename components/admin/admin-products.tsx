"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  FolderInput,
  Package,
  PackagePlus,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { EmptyState, SelectInput, TextInput } from "@/components/ui";
import {
  AdminThumb,
  PageHeader,
  formatINRShort,
  isActiveProduct,
} from "@/components/admin/shared";
import type { Category, DbStatus } from "@/lib/types";
import type { DbProduct } from "@/lib/demo/db";
import { useToast } from "@/components/admin/toast";

interface Row extends DbProduct {
  marginPct: number;
}

function categoryName(slug: string, categories: Category[]): string {
  return categories.find((c) => c.slug === slug)?.name ?? slug;
}

function formatDateTime(value?: string): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AdminProducts() {
  const router = useRouter();
  const toast = useToast();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [intakeBusy, setIntakeBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | DbStatus>("all");

  const loadProducts = useCallback(() => {
    return fetch("/api/admin/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; products?: DbProduct[]; categories?: Category[] }>)
      .then((d) => {
        if (!d.ok) throw new Error("Failed to load products");
        setRows(
          (d.products ?? []).map((p) => ({
            ...p,
            marginPct:
              p.price > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : 0,
          })),
        );
        setCategories(d.categories ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const processIncoming = useCallback(
    async (engine?: "qwen" | "cloudflare") => {
    setIntakeBusy(true);
    try {
      const res = await fetch("/api/admin/products/process-incoming", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engine }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        result?: {
          processed?: boolean;
          reason?: string;
          slug?: string;
          product_id?: string;
        };
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Could not process incoming image");
      }
      if (data.result?.processed === false) {
        toast.info(data.result.reason ?? "No incoming saree images found.");
      } else {
        toast.success("Incoming saree processed. Draft product created.");
        await loadProducts();
        router.refresh();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process incoming image");
    } finally {
      setIntakeBusy(false);
    }
    },
    [loadProducts, router, toast],
  );

  const remove = useCallback(
    async (slug: string, name: string) => {
      if (!window.confirm(`Delete "${name}"? It will be hidden from the store.`)) return;
      const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        cleanupError?: string;
        deletedImages?: number;
      };
      if (!data.ok) {
        toast.error(data.error ?? "Could not delete the product");
        return;
      }
      if (data.cleanupError) {
        toast.info(`"${name}" deleted. Media cleanup needs checking: ${data.cleanupError}`, {
          duration: 9000,
        });
      } else {
        toast.success(`"${name}" deleted${data.deletedImages ? ` with ${data.deletedImages} media file${data.deletedImages === 1 ? "" : "s"}` : ""}.`);
      }
      setRows((prev) => prev?.filter((p) => p.slug !== slug) ?? null);
      router.refresh();
    },
    [router, toast],
  );

  const filtered = useMemo(() => {
    if (!rows) return null;
    const q = query.trim().toLowerCase();
    return rows.filter((p) => {
      if (status !== "all" && p.dbStatus !== status) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.fabric.toLowerCase().includes(q) ||
        categoryName(p.category, categories).toLowerCase().includes(q)
      );
    });
  }, [rows, query, status, categories]);

  return (
    <div>
      <PageHeader
        title="Products"
        sub={`${rows?.length ?? "…"} sarees in the catalogue`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void processIncoming("qwen")}
              disabled={intakeBusy}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FolderInput size={16} />
              {intakeBusy ? "Processing…" : "Process incoming · Qwen"}
            </button>
            <button
              type="button"
              onClick={() => void processIncoming("cloudflare")}
              disabled={intakeBusy}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-line bg-surface px-5 text-[15px] font-semibold text-ink transition-colors hover:bg-surface2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FolderInput size={16} />
              {intakeBusy ? "Processing…" : "Process incoming · Cloudflare"}
            </button>
            <Link
              href="/admin/products/new"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-btn px-5 text-[15px] font-semibold text-btntext transition-opacity hover:opacity-90"
            >
              <PackagePlus size={16} /> Add saree
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
          />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, slug, fabric or category…"
            className="pl-10"
          />
        </div>
        <SelectInput
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="sm:w-44"
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active (live)</option>
          <option value="draft">Draft</option>
        </SelectInput>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {filtered === null ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface2" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Boxes size={26} />}
          title={rows?.length ? "No products match" : "No products yet"}
          body={
            rows?.length
              ? "Try a different search or status filter."
              : "Add your first saree — name, category, price and photos are enough to go live."
          }
          action={
            rows?.length ? undefined : (
              <Link
                href="/admin/products/new"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-btn px-5 text-[15px] font-semibold text-btntext"
              >
                <PackagePlus size={16} /> Add saree
              </Link>
            )
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((p) => (
            <li
              key={p.slug}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2.5 sm:gap-4 sm:px-4"
            >
              <AdminThumb product={p} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="truncate text-sm font-bold text-ink">{p.name}</p>
                  {isActiveProduct(p) && p.tags.includes("bestseller") && (
                    <span className="rounded-full bg-bronze/15 px-2 py-0.5 text-[10px] font-bold text-bronze">
                      Bestseller
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">
                  {categoryName(p.category, categories)} · {p.fabric || "Fabric TBD"} ·{" "}
                  {isActiveProduct(p) ? `${p.stock} in stock` : "Not live"}
                </p>
                <p className="mt-1 truncate text-[11px] text-muted/80">
                  Created {formatDateTime(p.createdAt)} · Updated {formatDateTime(p.updatedAt)}
                </p>
              </div>

              <div className="hidden shrink-0 text-right sm:block">
                <p className="text-sm font-bold text-ink">{formatINRShort(p.price)}</p>
                <p
                  className={`text-[11px] font-semibold ${
                    p.marginPct >= 40 ? "text-[#3f6b43]" : "text-muted"
                  }`}
                >
                  cost {formatINRShort(p.cost)} · {p.marginPct}% margin
                </p>
              </div>

              <span
                className={`hidden shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold md:inline ${
                  isActiveProduct(p)
                    ? "bg-[#4c7a4f]/15 text-[#3f6b43]"
                    : "bg-surface2 text-muted"
                }`}
              >
                {isActiveProduct(p) ? "Active" : "Draft"}
              </span>

              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={`/admin/products/${p.slug}`}
                  aria-label={`Edit ${p.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-accent"
                >
                  <Pencil size={15} />
                </Link>
                <button
                  type="button"
                  onClick={() => remove(p.slug, p.name)}
                  aria-label={`Delete ${p.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Package size={13} />
        {rows?.filter(isActiveProduct).length ?? 0} live ·{" "}
        {rows?.filter((p) => !isActiveProduct(p)).length ?? 0} draft ·{" "}
        {rows?.reduce((s, p) => s + p.stock, 0) ?? 0} units of stock
      </div>
      <p className="mt-1 text-xs text-muted">Margin shown is list price − unit cost.</p>
    </div>
  );
}
