"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { CATEGORIES } from "@/lib/data/catalog";
import { useCart, useWishlist } from "@/components/store/providers";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { cx } from "@/lib/utils";

/**
 * Primary navigation. `secondary` links live behind the drawer on tablets
 * (lg) and appear inline from xl, where there is room for all seven.
 */
const NAV = [
  { label: "Home", href: "/" },
  { label: "All Sarees", href: "/sarees" },
  { label: "Categories", href: "/categories", dropdown: true },
  { label: "New Arrivals", href: "/sarees?tag=new", secondary: true },
  { label: "Best Sellers", href: "/sarees?tag=bestseller", secondary: true },
  { label: "About Us", href: "/about", secondary: true },
  { label: "Contact Us", href: "/contact", secondary: true },
];

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold text-white">
      {count > 9 ? "9+" : count}
    </span>
  );
}

function isActive(pathname: string | null, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href.includes("?")) return false; // filter links are never "active"
  return pathname === href;
}

function SearchBox({
  autoFocus,
  onDone,
  className,
}: {
  autoFocus?: boolean;
  onDone?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      role="search"
      className={cx("relative w-full", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (!q) return;
        router.push(`/sarees?q=${encodeURIComponent(q)}`);
        onDone?.();
      }}
    >
      <Search
        size={17}
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-accent"
      />
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search for sarees..."
        aria-label="Search for sarees"
        className="h-11 w-full rounded-pill border border-line bg-surface pl-11 pr-4 text-[15px] text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
      />
    </form>
  );
}

function CategoriesDropdown({ inverted }: { inverted?: boolean }) {
  const router = useRouter();
  return (
    <div className="group relative">
      <button
        type="button"
        className={cx(
          "flex items-center gap-1 px-3 py-2 text-[13px] font-medium tracking-wide transition-colors",
          inverted ? "text-white/82 hover:text-white" : "text-ink2 hover:text-ink",
        )}
      >
        Categories
        <ChevronDown
          size={14}
          className="transition-transform group-hover:rotate-180"
        />
      </button>
      <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-3 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="grid w-[22rem] grid-cols-2 gap-1 rounded-panel border border-line bg-surface p-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)]">
          {CATEGORIES.map((c) => (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="rounded-card px-3 py-2.5 text-left text-sm font-medium text-ink2 transition-colors hover:bg-accent/10 hover:text-ink"
            >
              {c.short}
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                {c.blurb.split(".")[0]}
              </span>
            </Link>
          ))}
          <button
            type="button"
            onClick={() => router.push("/sarees")}
            className="col-span-2 mt-1 rounded-card border border-accent/30 px-3 py-2 text-center text-[13px] font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            Shop all sarees
          </button>
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isHome = pathname === "/";
  const glassHeader = isHome;
  const strongerGlass = scrolled || searchOpen || menuOpen;
  const activeHrefs = new Set<string>(
    NAV.map((n) => n.href).filter((h) => isActive(pathname, h)),
  );
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();

  useEffect(() => {
    if (!glassHeader) {
      setScrolled(false);
      return;
    }

    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [glassHeader]);

  // Transient UI closes itself: drawer links call onClose, and the search form
  // closes on submit — so no navigation effect (and no cascading render).
  const iconBtn = cx(
    "relative flex h-10 w-10 items-center justify-center rounded-pill transition-colors",
    glassHeader
      ? "text-white/84 hover:bg-white/12 hover:text-white"
      : "text-ink2 hover:bg-accent/12 hover:text-ink",
  );

  return (
    <header
      className={cx(
        "top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300",
        glassHeader ? "fixed inset-x-0" : "sticky",
      )}
    >
      <AnnouncementBar glass={glassHeader} scrolled={strongerGlass} />

      <div
        className={cx(
          "border-b backdrop-blur-xl transition-colors duration-300 supports-[backdrop-filter]:backdrop-blur-xl",
          glassHeader
            ? strongerGlass
              ? "border-white/16 bg-[#120c08]/78 shadow-[0_12px_36px_rgba(0,0,0,0.24)] supports-[backdrop-filter]:bg-[#120c08]/62"
              : "border-white/10 bg-[#120c08]/26 supports-[backdrop-filter]:bg-[#120c08]/18"
            : "border-line bg-bg/92 supports-[backdrop-filter]:bg-bg/85",
        )}
      >
        <div className="tt-container flex h-16 items-center gap-3 lg:h-[76px] lg:gap-5">
          {/* Mobile: menu */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className={cx(iconBtn, "-ml-2 lg:hidden")}
          >
            <Menu size={22} strokeWidth={1.8} />
          </button>

          {/* Logo */}
          <Logo compact lightOnDark={glassHeader} className="lg:-ml-1" />

          {/* Desktop nav */}
          <nav
            aria-label="Primary"
            className="hidden items-center justify-center gap-0.5 lg:flex lg:flex-1"
          >
            {NAV.map((item) => {
              const hidden = item.secondary
                ? "hidden xl:flex"
                : "flex";
              if (item.dropdown) {
                return (
                  <span key={item.label} className={hidden}>
                    <CategoriesDropdown inverted={glassHeader} />
                  </span>
                );
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cx(
                    hidden,
                    "items-center px-3 py-2 text-[13px] font-medium tracking-wide transition-colors",
                    glassHeader
                      ? activeHrefs.has(item.href)
                        ? "text-goldlight"
                        : "text-white/82 hover:text-white"
                      : activeHrefs.has(item.href)
                        ? "text-accent"
                        : "text-ink2 hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div className="ml-auto flex items-center gap-0.5 lg:ml-0">
            <button
              type="button"
              aria-label={searchOpen ? "Close search" : "Search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((v) => !v)}
              className={iconBtn}
            >
              {searchOpen ? <X size={20} /> : <Search size={20} strokeWidth={1.8} />}
            </button>

            <Link
              href="/wishlist"
              aria-label={`Wishlist, ${wishCount} items`}
              className={cx(iconBtn, "hidden sm:flex")}
            >
              <Heart size={20} strokeWidth={1.8} />
              <CountBadge count={wishCount} />
            </Link>

            <Link
              href="/account"
              aria-label="My account"
              className={cx(iconBtn, "hidden sm:flex")}
            >
              <User size={20} strokeWidth={1.8} />
            </Link>

            <Link
              href="/cart"
              aria-label={`Cart, ${cartCount} items`}
              className={cx(iconBtn, "gap-0.5")}
            >
              <ShoppingCart size={20} strokeWidth={1.8} />
              <CountBadge count={cartCount} />
            </Link>

            <ThemeToggle className="hidden sm:flex" />
          </div>
        </div>

        {/* Expandable search — works at every width */}
        {searchOpen && (
          <div
            className={cx(
              "border-t",
              glassHeader ? "border-white/12" : "border-line",
            )}
          >
            <div className="tt-container py-3">
              <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
            </div>
          </div>
        )}
      </div>

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
