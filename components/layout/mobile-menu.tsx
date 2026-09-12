"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight, Heart, User, X } from "lucide-react";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/data/catalog";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { FacebookIcon, InstagramIcon } from "@/components/icons/brand";
import { cx } from "@/lib/utils";

const PRIMARY_LINKS = [
  { label: "Home", href: "/" },
  { label: "All Sarees", href: "/sarees" },
  { label: "New Arrivals", href: "/sarees?tag=new" },
  { label: "Best Sellers", href: "/sarees?tag=bestseller" },
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
];

/**
 * Mobile/tablet drawer — every route the desktop header exposes, plus
 * categories, account shortcuts, the theme toggle and social links.
 */
export function MobileMenu({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Escape closes; body scroll is locked while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={cx(
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* Scrim */}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={onClose}
        className={cx(
          "absolute inset-0 bg-black/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cx(
          "absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-bg2 shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <Logo compact />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink2 transition-colors hover:bg-accent/15 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          aria-label="Mobile menu"
          className="flex-1 overflow-y-auto px-5 py-5"
        >
          <ul className="space-y-0.5">
            {PRIMARY_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-medium text-ink transition-colors hover:bg-accent/10"
                >
                  {l.label}
                  <ChevronRight size={16} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>

          <p className="tt-eyebrow mt-6 px-3">Shop by category</p>
          <ul className="mt-2 space-y-0.5">
            {CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}`}
                  onClick={onClose}
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-ink2 transition-colors hover:bg-accent/10 hover:text-ink"
                >
                  {c.name}
                  <ChevronRight size={15} className="text-muted" />
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <Link
              href="/wishlist"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-pill border border-line px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent/50"
            >
              <Heart size={16} /> Wishlist
            </Link>
            <Link
              href="/account"
              onClick={onClose}
              className="flex items-center justify-center gap-2 rounded-pill border border-line px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-accent/50"
            >
              <User size={16} /> Account
            </Link>
          </div>
        </nav>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SITE.name} on Instagram`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink2 transition-colors hover:border-accent hover:text-accent"
            >
              <InstagramIcon size={16} />
            </a>
            <a
              href={SITE.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SITE.name} on Facebook`}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-ink2 transition-colors hover:border-accent hover:text-accent"
            >
              <FacebookIcon size={16} />
            </a>
          </div>
          <ThemeToggle />
        </div>
      </aside>
    </div>
  );
}
