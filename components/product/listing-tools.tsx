"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trackSearch } from "@/lib/analytics";
import type { SortKey } from "@/lib/data/queries";

/** Build a URL keeping any current params, applying updates ('' deletes). */
export function updateParams(
  pathname: string,
  updates: Record<string, string | undefined>,
): string {
  const sp = new URLSearchParams(window.location.search);
  for (const [k, v] of Object.entries(updates)) {
    if (v === undefined || v === "") sp.delete(k);
    else sp.set(k, v);
  }
  const q = sp.toString();
  return q ? `${pathname}?${q}` : pathname;
}

export function ListingSearch({ initial }: { initial?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial ?? "");

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/sarees?q=${encodeURIComponent(q)}` : "/sarees");
      }}
    >
      <Search
        size={17}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search sarees by name, fabric..."
        aria-label="Search sarees"
        className="h-11 w-full rounded-full border border-line bg-surface pl-10 pr-4 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {pathname !== "/sarees" && <span className="hidden">{pathname}</span>}
    </form>
  );
}

const SORT_LABELS: Record<SortKey, string> = {
  popular: "Most popular",
  newest: "Newest first",
  rating: "Top rated",
};

export function SortSelect({ value }: { value: SortKey }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <select
      aria-label="Sort products"
      value={value}
      onChange={(e) =>
        router.push(
          updateParams(pathname, { sort: e.target.value || undefined }),
        )
      }
      className="h-11 cursor-pointer rounded-full border border-line bg-surface px-4 pr-9 text-sm font-semibold text-ink focus:border-accent focus:outline-none"
    >
      {Object.entries(SORT_LABELS).map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** Fires the Search analytics event once per page load carrying a query. */
export function SearchEvent({ q }: { q?: string }) {
  useEffect(() => {
    if (q?.trim()) trackSearch(q.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
