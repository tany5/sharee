"use client";

import Link from "next/link";
import Image from "next/image";
import type { CategoryWithCount } from "@/lib/types";
import { categoryPhoto } from "@/lib/photos";

/**
 * Short descriptors drawn from each category's existing blurb
 * (lib/data/catalog). Categories added later fall back to the first clause of
 * their own blurb, so no copy is invented here.
 */
const DESCRIPTORS: Record<string, string> = {
  "cotton-sarees": "Everyday comfort",
  "silk-sarees": "Timeless elegance",
  "printed-sarees": "Playful & stylish",
  "chiffon-sarees": "Featherlight flow",
  "georgette-sarees": "Light & graceful",
  "fancy-sarees": "For special days",
};

function descriptorFor(c: CategoryWithCount): string {
  return DESCRIPTORS[c.slug] ?? c.blurb.split(/[.,]/)[0];
}

/**
 * Category grid — no horizontal scrolling, so the section stays calm and fixed.
 */
export function CategoriesRail({
  categories,
}: {
  categories: CategoryWithCount[];
}) {
  return (
    <div
      aria-label="Browse categories"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 lg:gap-5"
    >
      {categories.map((c) => (
        <Link key={c.slug} href={`/categories/${c.slug}`} className="group">
          <div className="relative aspect-[4/5] overflow-hidden rounded-panel border border-line">
            {categoryPhoto(c.slug) && (
              <Image
                src={categoryPhoto(c.slug)!}
                alt={`${c.name} — woman wearing the saree`}
                fill
                sizes="(min-width: 1024px) 18vw, (min-width: 640px) 30vw, 45vw"
                className="object-cover object-top transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
              />
            )}
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 p-3.5">
              <p className="font-display text-[17px] font-semibold leading-tight text-white">
                {c.name}
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-white/75">
                {descriptorFor(c)}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
