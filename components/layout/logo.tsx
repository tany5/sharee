import Link from "next/link";
import Image from "next/image";
import { SITE } from "@/lib/site";
import { cx } from "@/lib/utils";

/**
 * Brand logo — the TheTanti lockup (public/logo/logo.png).
 *
 * The artwork is transparent with two built variants:
 *   logo.webp       — dark maroon, for light surfaces (light header)
 *   logo-light.webp — warm ivory + gold recolor, for dark surfaces
 *                     (dark header, footer, admin sidebar)
 * No chip/box is painted behind it — it sits directly on the surface and
 * blends with the theme.
 */
export function Logo({
  className,
  compact,
  lightOnDark,
}: {
  className?: string;
  /** Compact size for sticky headers on small screens. */
  compact?: boolean;
  /** Use the ivory/gold lockup when the header sits on photography. */
  lightOnDark?: boolean;
}) {
  // Desktop lockup 120–145px wide, mobile 95–110px (see design spec §11).
  const sizeCls = compact
    ? "max-h-[34px] max-w-[110px] sm:max-w-[132px] lg:max-w-[142px]"
    : "max-h-[52px] max-w-[200px]";
  return (
    <Link
      href="/"
      aria-label={`${SITE.name} — ${SITE.tagline}`}
      className={cx("inline-flex shrink-0 items-center", className)}
    >
      {/* Dark maroon lockup — bright surfaces (header, mobile menu) */}
      <Image
        src="/logo/logo.webp"
        alt={`${SITE.name} — ${SITE.tagline}`}
        width={480}
        height={216}
        priority
        className={cx(
          "h-auto w-auto object-contain",
          lightOnDark && "hidden",
          sizeCls,
        )}
      />
      {/* Ivory + gold lockup — deep surfaces only (passed via lightOnDark) */}
      <Image
        src="/logo/logo-light.webp"
        alt={`${SITE.name} — ${SITE.tagline}`}
        width={480}
        height={216}
        priority
        className={cx(
          "h-auto w-auto object-contain",
          lightOnDark ? "block" : "hidden",
          sizeCls,
        )}
      />
    </Link>
  );
}
