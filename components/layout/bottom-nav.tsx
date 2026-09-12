"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, Home, ShoppingBag, User } from "lucide-react";
import { useWishlist } from "@/components/store/providers";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

const ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shop", href: "/sarees", icon: ShoppingBag },
  { label: "Categories", href: "/categories", icon: LayoutGrid },
  { label: "Wishlist", href: "/wishlist", icon: Heart },
  { label: "Account", href: "/account", icon: User },
];

/**
 * Fixed mobile navigation. Every entry is a real route the app already
 * exposes (the header drawer carries the rest).
 */
export function BottomNav() {
  const pathname = usePathname();
  const { count: wishlistCount } = useWishlist();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Product pages, checkout and order confirmation have their own sticky bars.
  const hidden =
    pathname === "/checkout" ||
    pathname === "/order-success" ||
    /^\/sarees\/[^/]+$/.test(pathname);
  if (hidden) return null;

  return (
    <nav
      aria-label="Mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg2/95 backdrop-blur supports-[backdrop-filter]:bg-bg2/90 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cx(
                "relative flex min-h-11 flex-col items-center gap-1 pb-2.5 pt-2.5 transition-colors",
                active ? "text-accent" : "text-ink2 hover:text-ink",
              )}
            >
              <span className="relative">
                <Icon size={22} strokeWidth={active ? 2.1 : 1.7} />
                {href === "/wishlist" && wishlistCount > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-pill bg-accent px-1 text-[10px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
      <span className="sr-only">
        {SITE.name} — {SITE.tagline}
      </span>
    </nav>
  );
}
