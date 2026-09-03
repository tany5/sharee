/**
 * Real photography of women wearing sarees (Pexels, free to use, stable CDN
 * URLs). Every seeded saree + the hero + category cards render one of these
 * "worn" shots instead of bare fabric, so the store feels like a live fashion
 * brand. Swap any URL for your own model photography later — the map is the
 * single source, with the generative artwork kept as fallback.
 *
 * URL shape: https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg
 */

export function pexels(id: number, w = 900): string {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
}

/** Hero — an editorial "woman in a rich maroon-gold drape" portrait. */
export const HERO_PHOTO = pexels(27575174, 1200);

/** One representative worn shot per category (category cards + banners). */
export const CATEGORY_PHOTOS: Record<string, string> = {
  "cotton-sarees": pexels(7486657),
  "silk-sarees": pexels(29156971),
  "printed-sarees": pexels(38325045),
  "chiffon-sarees": pexels(36024072),
  "georgette-sarees": pexels(20077350),
  "fancy-sarees": pexels(12999437),
};

/** Fallbacks for categories added later in the admin panel. */
const CATEGORY_FALLBACKS = [
  pexels(35108807),
  pexels(33729227),
  pexels(19600007),
  pexels(30188034),
];

export function categoryPhoto(slug: string): string | undefined {
  if (CATEGORY_PHOTOS[slug]) return CATEGORY_PHOTOS[slug];
  // Stable-ish fallback for categories added later (no randomness between renders).
  const i = (slug.length * 7 + slug.charCodeAt(0)) % CATEGORY_FALLBACKS.length;
  return CATEGORY_FALLBACKS[i];
}

/** Every seeded saree, keyed by slug → worn photo. */
export const PRODUCT_PHOTOS: Record<string, number> = {
  "beautiful-banarasi-silk-saree": 29156971, // rich maroon + gold, flagships
  "kanjeevaram-style-silk-saree": 35586011, // forest green + jewellery
  "banarasi-georgette-silk-saree": 35108807, // blush silk
  "south-silk-temple-saree": 33882521, // deep green temple drape
  "silk-zari-fancy-border-saree": 20158861, // mustard zari, stone corridor
  "soft-daily-wear-cotton-saree": 13556678, // ivory everyday wear
  "handloom-chettinad-cotton-saree": 28943616, // rust/terracotta tones
  "bandhani-inspired-cotton-saree": 12985823, // blush + gold dots
  "cotton-silk-festive-saree": 30188034, // festive yellow
  "kalamkari-print-cotton-saree": 35108863, // teal + artisanal print
  "everyday-silk-mark-cotton-saree": 7486657, // classic maroon drape
  "floral-printed-saree": 33729227, // floral green
  "pastel-abstract-printed-saree": 38187748, // soft blush print
  "temple-border-printed-saree": 19284702, // maroon temple border
  "mango-motif-printed-saree": 28058263, // plum mango motifs
  "bold-block-print-cotton-saree": 38130866, // bold yellow block print
  "featherlight-chiffon-saree": 19600007, // indigo sheer
  "chiffon-zari-border-saree": 12999437, // maroon zari chiffon
  "pastel-sheer-chiffon-saree": 35108820, // blush silk chiffon
  "chiffon-printed-drape-saree": 36024072, // blue-green printed drape
  "georgette-designer-saree": 31302931, // elegant navy designer drape
  "georgette-silk-blend-saree": 36041221, // green silk blend
  "georgette-floral-fancy-saree": 38325045, // rust + floral fancy
  "pearl-border-georgette-saree": 20077350, // ivory pearl border
  "designer-party-wear-saree": 31450186, // maroon party wear
  "net-fancy-saree-with-lace": 13679117, // bright drape with lace
  "golden-tissue-fancy-saree": 35108770, // gold tissue elegance
  "mirror-work-fancy-saree": 36041230, // indigo mirror work
};

/** Full-size URL for a product photo (cached for hot renders). */
const urlCache = new Map<string, string>();
export function productPhoto(slug: string): string | undefined {
  const id = PRODUCT_PHOTOS[slug];
  if (!id) return undefined;
  const hit = urlCache.get(slug);
  if (hit) return hit;
  const url = pexels(id);
  urlCache.set(slug, url);
  return url;
}

/** Compact thumb (cart, checkout, wishlist rows). */
export function productPhotoThumb(slug: string): string | undefined {
  const id = PRODUCT_PHOTOS[slug];
  return id ? pexels(id, 320) : undefined;
}
