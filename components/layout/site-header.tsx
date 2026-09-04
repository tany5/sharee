"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/data/catalog";
import { useCart, useWishlist } from "@/components/store/providers";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { cx } from "@/lib/utils";

const NAV = [
  { label: "Home", href: "/" },
  { label: "All Sarees", href: "/sarees" },
  { label: "Categories", href: "/categories", dropdown: true },
  { label: "New Arrivals", href: "/sarees?tag=new" },
  { label: "Best Sellers", href: "/sarees?tag=bestseller" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
];

function CartIconWithCount() {
  const { count } = useCart();
  return (
    <span className="relative inline-flex">
      <ShoppingCart size={21} strokeWidth={1.9} />
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-btn px-1 text-[10px] font-bold text-btntext">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </span>
  );
}

function WishlistIconWithCount() {
  const { count } = useWishlist();
  return (
    <span className="relative inline-flex">
      <Heart size={21} strokeWidth={1.9} />
      {count > 0 && (
        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-btn px-1 text-[10px] font-bold text-btntext">
          {count}
        </span>
      )}
    </span>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.includes("?")) return false; // filter links are never "active"
  return pathname === href;
}

function SearchBox({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className="relative flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        router.push(`/sarees?q=${encodeURIComponent(q)}`);
        onDone?.();
      }}
    >
      <Search
        size={18}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
      />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for sarees..."
        aria-label="Search for sarees"
        className="h-11 w-full rounded-full border border-line bg-surface pl-11 pr-4 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </form>
  );
}

function CategoriesDropdown() {
  const router = useRouter();
  return (
    <div className="group relative">
      <button
        type="button"
        className="flex items-center gap-1 px-3 py-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink2 transition-colors hover:text-ink"
      >
        Categories
        <ChevronDown size={14} className="transition-transform group-hover:rotate-180" />
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="grid w-72 grid-cols-2 gap-1 rounded-2xl border border-line bg-surface p-3 shadow-xl shadow-ink/10">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink2 transition-colors hover:bg-accent/10 hover:text-ink"
            >
              {c.short}
              <span className="mt-0.5 block text-[11px] text-muted">{c.blurb.split(".")[0]}…</span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => router.push("/sarees")}
            className="col-span-2 mt-1 rounded-xl border border-accent/30 px-3 py-2 text-center text-[13px] font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            View all sarees
          </button>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const activeHrefs = new Set<string>(NAV.map((n) => n.href).filter((h) => isActive(pathname, h)));
  const { count: cartCount } = useCart();

  return (
    <header className="sticky top-0 z-40">
      {/* Announcement bar — deep maroon in both themes so the promise always reads */}
      <div className="bg-[#4a2a18] text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f7ead2]">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-center gap-2.5 overflow-hidden px-4">
          <p className="truncate">{SITE.announcementMain}</p>
          <span aria-hidden className="hidden text-[#c9a86a] sm:inline">
            ✦
          </span>
          <p className="hidden truncate sm:inline">{SITE.announcementSub}</p>
        </div>
      </div>

      {/* Main header */}
      <div className="border-b border-line bg-bg/90 backdrop-blur supports-[backdrop-filter]:bg-bg/80">
        <div className="mx-auto flex h-[74px] max-w-7xl items-center gap-4 px-4 sm:px-6">
          <Logo compact />

          {/* Desktop search */}
          <div className="ml-2 hidden flex-1 max-w-md lg:block">
            <SearchBox />
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <Link
              href="/account"
              aria-label="My account"
              className="hidden h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink2 transition-colors hover:bg-accent/15 hover:text-ink md:flex"
            >
              <User size={20} strokeWidth={1.9} />
              My Account
            </Link>
            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="hidden h-10 w-10 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-ink sm:flex"
            >
              <WishlistIconWithCount />
            </Link>

            <button
              type="button"
              aria-label="Search"
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-ink lg:hidden"
            >
              {mobileSearchOpen ? <X size={21} /> : <Search size={21} strokeWidth={1.9} />}
            </button>

            <ThemeToggle />

            <Link
              href="/cart"
              aria-label={`Cart with ${cartCount} items`}
              className="flex h-10 items-center justify-center gap-1.5 rounded-full px-3 text-ink2 transition-colors hover:bg-accent/15 hover:text-ink"
            >
              <CartIconWithCount />
              <span className="hidden text-[13px] font-semibold md:inline">
                Cart ({cartCount})
              </span>
            </Link>
          </div>
        </div>

        {/* Mobile expandable search */}
        {mobileSearchOpen && (
          <div className="border-t border-line px-4 pb-3 pt-2 lg:hidden">
            <SearchBox autoFocus onDone={() => setMobileSearchOpen(false)} />
          </div>
        )}
      </div>

      {/* Desktop nav */}
      <nav className="hidden border-b border-line bg-bg/90 lg:block" aria-label="Primary">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-1 px-6">
          {NAV.map((item) =>
            item.dropdown ? (
              <CategoriesDropdown key={item.label} />
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={cx(
                  "px-3 py-2.5 text-[13px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  activeHrefs.has(item.href)
                    ? "text-ink underline decoration-accent decoration-2 underline-offset-8"
                    : "text-ink2 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}
