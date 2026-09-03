import { IndianRupee, HeartHandshake, BadgeCheck, Leaf } from "lucide-react";
import { PageShell, Prose } from "@/components/pages/page-shell";
import { ButtonLink } from "@/components/ui";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "About Us",
  description:
    "Ambika exists to prove a simple point: beautiful, well-made sarees should not cost a fortune. Every saree, ₹199. Quality assured, honest pricing, delivered across India.",
  path: "/about",
});

const VALUES = [
  {
    Icon: IndianRupee,
    t: "One honest price",
    s: "No markups, no fake discounts, no 'compare at ₹2,999'. One price for every saree — ₹199, always.",
  },
  {
    Icon: BadgeCheck,
    t: "Quality checked",
    s: "Every piece is inspected for fabric, fall and finishing before it ships. What you see is what you wear.",
  },
  {
    Icon: Leaf,
    t: "Weavers at heart",
    s: "Our collections celebrate Indian handloom traditions — bandhani, Kalamkari, Banarasi and more.",
  },
  {
    Icon: HeartHandshake,
    t: "You first, always",
    s: "7-day easy returns, responsive support on call or WhatsApp, and fast delivery from our Jaipur hub.",
  },
];

export default function AboutPage() {
  return (
    <PageShell
      kicker="Our story"
      title="Beautiful sarees shouldn't cost a fortune"
      lede={`Ambika started with a question: why should a well-made saree cost more than a week's groceries? We went to the looms, cut every middleman we could, and landed on a number that makes the answer simple — ${SITE.tagline}.`}
    >
      <Prose>
        <p>
          Every saree we sell is designed in-house, sourced directly from
          weavers and textile hubs across India, and quality checked at our
          Jaipur fulfilment centre before it reaches you. Because we keep one
          stock-keeping price for everything, our buying, packing and logistics
          stay simple — and that simplicity is exactly what lets us sell at a
          price that feels almost unfair.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {VALUES.map(({ Icon, t, s }) => (
            <div
              key={t}
              className="rounded-2xl border border-line bg-bg/60 p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon size={21} strokeWidth={1.7} />
              </span>
              <h3 className="mt-4 font-display text-lg font-bold text-ink">{t}</h3>
              <p className="mt-1.5 text-sm leading-6 text-ink2">{s}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-bronze/40 bg-bronze/10 p-6 text-center sm:p-8">
          <h2 className="font-display text-2xl font-bold text-ink">
            One price. Zero compromise.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink2">
            Join the 2,000+ customers who already wear Ambika. Every saree ships
            with free returns within 7 days.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <ButtonLink href="/sarees">Shop All Sarees</ButtonLink>
            <ButtonLink href="/contact" variant="outline">
              Talk to us
            </ButtonLink>
          </div>
        </div>
      </Prose>
    </PageShell>
  );
}
