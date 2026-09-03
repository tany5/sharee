import Link from "next/link";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

export function Logo({
  className,
  compact,
}: {
  className?: string;
  /** Compact size for sticky headers on small screens. */
  compact?: boolean;
}) {
  return (
    <Link
      href="/"
      aria-label={`${SITE.name} — ${SITE.tagline}`}
      className={cx("flex flex-col leading-none", className)}
    >
      <span
        className={cx(
          "font-display font-bold tracking-[0.22em] text-ink",
          compact ? "text-xl" : "text-[26px] sm:text-[30px]",
        )}
      >
        {SITE.name.toUpperCase()}
      </span>
      <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.32em] text-accent">
        All Sarees ₹199
      </span>
    </Link>
  );
}
