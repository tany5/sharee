import { SITE } from "@/lib/site";

/**
 * Rose-pink promise bar — always the first thing on the page.
 * The two claims come from lib/site.ts and are backed by the live store rules
 * (single ₹199 price, shipping always free — see lib/cart.ts).
 */
export function AnnouncementBar() {
  return (
    <div className="bg-accent text-btntext">
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
