import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

/**
 * Terracotta promise bar — always the first thing on the page.
 * The two claims come from lib/site.ts and are backed by the live store rules
 * (single ₹199 price, free shipping at ₹999 — see lib/cart.ts).
 */
export function AnnouncementBar({
  glass,
  scrolled,
}: {
  glass?: boolean;
  scrolled?: boolean;
}) {
  return (
    <div
      className={cx(
        "text-btntext transition-colors duration-300",
        glass
          ? scrolled
            ? "border-b border-white/10 bg-accent/72 backdrop-blur-xl supports-[backdrop-filter]:bg-accent/62"
            : "border-b border-white/10 bg-[#4b170f]/42 backdrop-blur-md supports-[backdrop-filter]:bg-[#4b170f]/34"
          : "bg-accent",
      )}
    >
      <div className="tt-container flex h-7 items-center justify-center gap-2 overflow-hidden sm:h-8 sm:gap-3">
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] sm:text-[11px] sm:tracking-[0.16em]">
          {SITE.announcementMain}
        </p>
        <span aria-hidden className="shrink-0 opacity-50">
          •
        </span>
        <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] opacity-95 sm:text-[11px] sm:tracking-[0.16em]">
          {SITE.announcementSub}
        </p>
      </div>
    </div>
  );
}
