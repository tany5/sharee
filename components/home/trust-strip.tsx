import { IndianRupee, RotateCcw, ShieldCheck, Truck } from "lucide-react";
import { SITE } from "@/lib/site";
import { formatINR } from "@/lib/format";

/**
 * Four promises, all backed by live store rules or published policies:
 *   · one ₹199 price      — lib/site.ts + lib/cart.ts
 *   · 7-day returns       — /return-policy
 *   · delivery across India — /shipping-policy
 *   · quality check before dispatch — order handling
 * Nothing here is aspirational marketing.
 */
const ITEMS = [
  {
    Icon: IndianRupee,
    title: `${formatINR(SITE.price)} Flat`,
    sub: "Every saree, one price",
  },
  { Icon: RotateCcw, title: "Easy Returns", sub: "7-day return window" },
  { Icon: Truck, title: "Fast Delivery", sub: "Across India" },
  { Icon: ShieldCheck, title: "Quality Checked", sub: "Before every dispatch" },
];

export function TrustStrip() {
  return (
    <section
      aria-label="Store promises"
      className="border-y border-line bg-bg2"
    >
      <div className="tt-container grid grid-cols-2 gap-x-4 gap-y-6 py-7 md:grid-cols-4 md:py-8">
        {ITEMS.map(({ Icon, title, sub }) => (
          <div key={title} className="flex items-center gap-3">
            <Icon
              size={26}
              strokeWidth={1.5}
              className="shrink-0 text-accent"
            />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug text-ink sm:text-sm">
                {title}
              </p>
              <p className="text-[11px] leading-snug text-ink2 sm:text-xs">
                {sub}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
