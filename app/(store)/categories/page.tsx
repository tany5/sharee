import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCategories } from "@/lib/data/queries";
import { artForCategory } from "@/lib/art";
import SareeArt from "@/components/product/saree-art";
import { Ornament } from "@/components/ui";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Shop by Category",
  description:
    "Cotton, silk, printed, chiffon, georgette and fancy sarees — every single one at ₹199 with quality assurance and fast delivery across India.",
  path: "/categories",
});

export default async function CategoriesPage() {
  const categories = await getCategories();
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent">
          Shop by category
        </p>
        <h1 className="mt-2 text-3xl text-ink sm:text-5xl">Find your weave</h1>
        <Ornament className="mt-5" />
        <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-ink2">
          Six collections, one promise — every saree in every collection is
          ₹199, quality checked before it ships.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            className="group relative block overflow-hidden rounded-3xl ring-1 ring-line/80 transition-shadow hover:shadow-xl hover:shadow-ink/10"
          >
            <div className="relative aspect-[4/3.4]">
              <SareeArt
                spec={artForCategory(c.slug)}
                label={`${c.name} collection`}
                className="absolute inset-0 h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            </div>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e6d5b6]">
                {c.count} styles · {c.blurb}
              </p>
              <p className="mt-1 font-display text-xl font-bold text-white">
                {c.name}
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#f6ebd9]/95 px-3.5 py-1.5 text-xs font-bold text-[#431d0b] transition-colors group-hover:bg-white">
                Shop collection <ArrowRight size={13} />
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
