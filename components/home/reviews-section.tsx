import { SectionHeading, Stars } from "@/components/ui";
import { SITE } from "@/lib/site";
import { formatINR } from "@/lib/format";

/**
 * Customer stories band. The three quotes are the quotes the store already
 * publishes on the homepage — reproduced verbatim, nothing added.
 */
const REVIEWS = [
  {
    name: "Riya S.",
    place: "Kolkata",
    text: "Three Banarasi sarees for less than the price of one elsewhere. The zari and fall genuinely surprised me.",
  },
  {
    name: "Meera K.",
    place: "Chennai",
    text: "Ordered on Monday, wore it to my cousin's engagement on Friday. Beautiful drape, zero regrets.",
  },
  {
    name: "Sneha P.",
    place: "Pune",
    text: "At ₹199 I expected a compromise. This was the opposite — rich colours and soft fabric. Bought three more.",
  },
];

export function ReviewsSection() {
  return (
    <section
      aria-label="Customer reviews"
      className="border-y border-line bg-bg2"
    >
      <div className="tt-container grid gap-8 py-12 lg:grid-cols-12 lg:gap-10 lg:py-20">
        <div className="lg:col-span-4">
          <SectionHeading title="Real customers, real sarees." />
          <p className="mt-3 max-w-sm text-sm leading-6 text-ink2">
            Every order is quality-checked before it ships. Here is what buyers
            say about their {formatINR(SITE.price)} sarees.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
          {REVIEWS.map((r) => (
            <figure
              key={r.name}
              className="flex h-full flex-col rounded-panel border border-line bg-surface p-5"
            >
              <Stars rating={5} size={13} />
              <blockquote className="mt-3 flex-1 text-sm leading-6 text-ink2">
                “{r.text}”
              </blockquote>
              <figcaption className="mt-4 text-[13px] font-medium text-ink">
                {r.name}{" "}
                <span className="font-normal text-muted">· {r.place}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
