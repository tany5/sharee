"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutGrid, Home, ShoppingBag, User } from "lucide-react";
import { cx } from "@/lib/utils";

const ITEMS = [
  { label: "Home", href: "/", icon: Home },
  { label: "Shop", href: "/sarees", icon: ShoppingBag },
  { label: "Categories", href: "/categories", icon: LayoutGrid },
  { label: "Wishlist", href: "/wishlist", icon: Heart },
  { label: "Account", href: "/account", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90 lg:hidden"
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
                "flex flex-col items-center gap-1 pb-2.5 pt-2.5 transition-colors",
                active ? "text-accent" : "text-muted hover:text-ink2",
              )}
            >
              <Icon size={21} strokeWidth={active ? 2.1 : 1.8} />
              <span className="text-[10px] font-semibold tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
