import Image from "next/image";
import { SITE } from "@/lib/site";
import { InstagramIcon } from "@/components/icons/brand";
import { categoryPhoto } from "@/lib/photos";

/**
 * Community strip — built from photography the store already ships
 * (public/banner + the worn-saree shots used by category cards).
 * Tiles are links to the real Instagram profile; there is no invented feed.
 */
const TILES = [
  { src: "/banner/banner-1.webp", alt: "Saree drape detail from a recent look" },
  { src: categoryPhoto("cotton-sarees")!, alt: "Cotton saree worn by a customer" },
  { src: "/banner/banner-2.webp", alt: "Saree pallu detail" },
  { src: categoryPhoto("silk-sarees")!, alt: "Silk saree worn by a customer" },
  { src: "/banner/banner-4.webp", alt: "Festive saree styling" },
  { src: categoryPhoto("printed-sarees")!, alt: "Printed saree worn by a customer" },
  { src: "/banner/banner-5.webp", alt: "Golden saree styling" },
];

export function InstagramGrid() {
  return (
    <section
      aria-labelledby="instagram-heading"
      className="tt-container py-12 lg:py-20"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <p className="tt-eyebrow flex items-center gap-2.5">
            Follow our journey
            <span aria-hidden className="h-px w-8 bg-accent/35 sm:w-12" />
          </p>
          <h2
            id="instagram-heading"
            className="flex items-center gap-3 font-display text-[26px] leading-tight text-ink sm:text-[32px] lg:text-[38px]"
          >
            {SITE.instagramHandle}
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${SITE.name} on Instagram`}
              className="text-ink2 transition-colors hover:text-accent"
            >
              <InstagramIcon size={22} />
            </a>
          </h2>
        </div>
        <p className="pb-1 text-xs text-muted">
          Real women, real moments
        </p>
      </div>

      <ul className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-7">
        {TILES.map((t, i) => (
          <li key={`${t.src}-${i}`}>
            <a
              href={SITE.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden rounded-lg border border-line"
            >
              <span className="relative block aspect-square">
                <Image
                  src={t.src}
                  alt={t.alt}
                  fill
                  sizes="(min-width: 1024px) 14vw, (min-width: 640px) 25vw, 33vw"
                  loading="lazy"
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transition-none"
                />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
