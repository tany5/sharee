import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { getCategories, getProducts } from "@/lib/data/queries";
import { artForCategory } from "@/lib/art";
import SareeArt from "@/components/product/saree-art";
import { swatchFor } from "@/lib/color-dots";
import { SITE } from "@/lib/site";
import { formatINR } from "@/lib/format";

/**
 * Extra Sudathi-style homepage sections that show the actual catalogue:
 * colours → tag rows → category split tiles → best-seller banner → newsletter.
 * Every tile links into the real listing filters; nothing is invented.
 */

/* ------------------------------ Colours ------------------------------ */

/**
 * Canonical base colours, longest-first so "forest green" beats "green".
 * Each maps [swatchKey, label]; the swatch key is a lib/color-dots entry so
 * the dot colour stays consistent with the rest of the store.
 */
const BASE_COLORS: [string, string][] = [
  ["ivory cream", "Ivory"],
  ["mustard yellow", "Mustard"],
  ["forest green", "Green"],
  ["indigo blue", "Indigo"],
  ["navy blue", "Navy"],
  ["blush pink", "Blush"],
  ["rust orange", "Rust"],
  ["deep green", "Green"],
  ["deep red", "Red"],
  ["baby pink", "Pink"],
  ["maroon", "Maroon"],
  ["yellow", "Yellow"],
  ["pink", "Pink"],
  ["green", "Green"],
  ["blue", "Blue"],
  ["teal", "Teal"],
  ["orange", "Orange"],
  ["brown", "Brown"],
  ["plum", "Plum"],
  ["purple", "Purple"],
  ["cream", "Cream"],
  ["white", "White"],
  ["beige", "Beige"],
  ["red", "Red"],
];

export async function ShopByColour() {
  const products = await getProducts({ limit: 300 });

  // Aggregate every product colour string into short base colours with counts.
  const counts = new Map<
    string,
    { label: string; swatchKey: string; count: number }
  >();
  for (const p of products) {
    const bases = new Map<string, string>(); // label -> swatchKey
    for (const raw of p.colors ?? []) {
      const c = raw.toLowerCase();
      for (const [key, label] of BASE_COLORS) {
        if (c.includes(key)) {
          bases.set(label, key);
          break; // longest-first list: first hit is the most specific
        }
      }
      if (bases.size >= 2) break;
    }
    for (const [label, swatchKey] of bases) {
      const cur = counts.get(label);
      counts.set(label, {
        label,
        swatchKey,
        count: (cur?.count ?? 0) + 1,
      });
    }
  }

  const top = [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  if (top.length === 0) return null;

  return (
    <section aria-label="Shop by colour" className="tt-container py-12 lg:py-16">
      <SectionHead kicker="Pick your shade" title="Shop by Colour" />
      <div className="no-scrollbar mt-6 flex gap-4 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0 lg:grid-cols-8">
        {top.map(({ label, swatchKey, count }) => (
          <Link
            key={label}
            href={`/sarees?color=${encodeURIComponent(label.toLowerCase())}`}
            className="group flex w-16 shrink-0 flex-col items-center gap-1.5 sm:w-auto"
          >
            <span
              className="h-12 w-12 rounded-full border-2 border-line shadow-sm transition-transform duration-200 group-hover:scale-110 group-hover:border-accent sm:h-16 sm:w-16"
              style={{ backgroundColor: swatchFor(swatchKey) }}
              aria-hidden
            />
            <span className="text-center text-[11px] font-semibold leading-tight text-ink2 transition-colors group-hover:text-accent">
              {label}
              <span className="block text-[10px] font-medium text-muted">
                {count} {count === 1 ? "style" : "styles"}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ------------------------- Category split tiles ----------------------- */
export async function CollectionTiles() {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts({ limit: 200 }),
  ]);
  // Stocked categories first so tiles always lead somewhere useful; any
  // category still waiting on stock renders brand-consistent saree art
  // instead of a blank card (never an empty white box).
  const top = [...categories]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  if (top.length === 0) return null;

  return (
    <section aria-label="Collections" className="tt-container py-12 lg:py-16">
      <SectionHead
        kicker="The saree store"
        title="Shop Collections"
        action={
          <Link
            href="/categories"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent transition-colors hover:text-accent2"
          >
            All categories <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {top.map((c) => {
          const cover =
            products.find((p) => p.category === c.slug)?.images?.[0] ?? "";
          return (
            <Link
              key={c.slug}
              href={`/categories/${c.slug}`}
              className="group relative aspect-[4/5] overflow-hidden rounded-panel border border-line"
            >
              {cover ? (
                <Image
                  src={cover}
                  alt={`${c.name} collection`}
                  fill
                  sizes="(min-width: 1024px) 24vw, 46vw"
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-[1.04]"
                />
              ) : (
                <SareeArt
                  spec={artForCategory(c.slug, 1)}
                  label={c.name}
                  crop="portrait"
                  className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
                />
              )}
              <div
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/25 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="font-display text-[17px] font-semibold text-white">
                  {c.name}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/80">
                  {c.count} {c.count === 1 ? "style" : "styles"}
                  <ArrowRight
                    size={12}
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  />
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------- Best-seller banner ------------------------- */
export async function PromoBanner() {
  const bestSellers = await getProducts({ tag: "bestseller", limit: 1 });
  const hero = bestSellers[0];
  const cover = hero?.images?.[0];

  return (
    <section aria-label="One price promise" className="tt-container py-12 lg:py-16">
      <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(120deg,#e2448f_0%,#c22e6f_58%,#a1215a_100%)] px-6 py-10 text-white shadow-xl shadow-accent/25 sm:px-10 sm:py-12 lg:px-14">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-white/8"
        />
        <div className="relative flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/85">
              One price · Every saree
            </p>
            <p className="mt-3 font-display text-4xl font-bold leading-tight sm:text-5xl">
              Everything at {formatINR(SITE.price)}.
              <br />
              Yes, everything.
            </p>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-white/85">
              No sales, no tricks — one honest price for every saree in the
              store, and FREE shipping on every order (the ₹49 fee is on us).
            </p>
            <Link
              href="/sarees"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-pill bg-white px-7 text-[15px] font-bold text-accentdeep shadow-lg transition-transform duration-200 hover:scale-[1.03]"
            >
              Shop All Sarees <ArrowRight size={17} />
            </Link>
          </div>
          {cover ? (
            <div className="relative h-56 w-44 shrink-0 overflow-hidden rounded-2xl shadow-2xl sm:h-64 sm:w-52">
              <Image
                src={cover}
                alt={hero ? `${hero.name} — best seller` : "Best seller"}
                fill
                sizes="(min-width: 1024px) 208px, 176px"
                className="object-cover object-top"
              />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------ Shared UI ----------------------------- */
function SectionHead({
  kicker,
  title,
  blurb,
  action,
}: {
  kicker: string;
  title: string;
  blurb?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="tt-eyebrow">{kicker}</p>
        <h2 className="mt-1.5 text-3xl font-semibold text-ink sm:text-4xl">
          {title}
        </h2>
        {blurb ? (
          <p className="mt-1.5 text-[14px] text-ink2">{blurb}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
