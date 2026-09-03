/**
 * Seed catalogue for the demo storefront. Every saree is ₹199 (see lib/site.ts).
 *
 * In production this data comes from Supabase (see supabase/migrations/0001_init.sql);
 * the async query layer in lib/data/queries.ts mirrors that future API so pages
 * don't change when the source switches.
 */
import type { Category, Product } from "@/lib/types";
import { SITE } from "@/lib/site";

export const CATEGORIES: Category[] = [
  {
    slug: "cotton-sarees",
    name: "Cotton Sarees",
    short: "Cotton",
    blurb: "Breathable handloom weaves for everyday grace.",
  },
  {
    slug: "silk-sarees",
    name: "Silk Sarees",
    short: "Silk",
    blurb: "Rich zari and lustre for celebrations.",
  },
  {
    slug: "printed-sarees",
    name: "Printed Sarees",
    short: "Printed",
    blurb: "Bold prints that turn heads every day.",
  },
  {
    slug: "chiffon-sarees",
    name: "Chiffon Sarees",
    short: "Chiffon",
    blurb: "Featherlight flow with a soft fall.",
  },
  {
    slug: "georgette-sarees",
    name: "Georgette Sarees",
    short: "Georgette",
    blurb: "Crepe textures that drape like a dream.",
  },
  {
    slug: "fancy-sarees",
    name: "Fancy Sarees",
    short: "Fancy",
    blurb: "Party-ready designs and statement borders.",
  },
];

interface ProductInput {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  details: string;
  fabric: string;
  occasion: string;
  colorway: string;
  colors?: string[];
  rating?: number;
  reviewCount?: number;
  stock?: number;
  tags?: string[];
  featured?: boolean;
  createdAt?: string;
}

function product(input: ProductInput): Product {
  return {
    id: input.id,
    name: input.name,
    slug: input.slug,
    category: input.category,
    description: input.description,
    details: input.details,
    fabric: input.fabric,
    occasion: input.occasion,
    colorway: input.colorway,
    colors: input.colors ?? [input.colorway],
    price: SITE.price,
    rating: input.rating ?? 4.6,
    reviewCount: input.reviewCount ?? 42,
    stock: input.stock ?? 24,
    tags: input.tags ?? [],
    featured: input.featured ?? false,
    createdAt: input.createdAt ?? "2026-01-15",
  };
}

export const PRODUCTS: Product[] = [
  // ------------------------------ Silk ------------------------------
  product({
    id: "sil-01",
    name: "Beautiful Banarasi Silk Saree",
    slug: "beautiful-banarasi-silk-saree",
    category: "silk-sarees",
    description: "Elegant Banarasi silk saree with beautiful zari work and a rich pallu.",
    details:
      "Woven on traditional handlooms in Varanasi, this Banarasi silk saree pairs a soft lustrous body with intricate zari patterns across the border and pallu. The rich maroon base makes it a timeless pick for weddings, festivals and family celebrations.\n\nComes with a matching unstitched blouse piece. Dry clean recommended.",
    fabric: "Pure Banarasi silk with gold zari",
    occasion: "Weddings · Festivals · Parties",
    colorway: "Maroon",
    colors: ["Maroon", "Dark Plum", "Deep Green", "Navy Blue"],
    rating: 4.8,
    reviewCount: 128,
    tags: ["bestseller", "new"],
    featured: true,
    createdAt: "2026-08-18",
  }),
  product({
    id: "sil-02",
    name: "Kanjeevaram Style Silk Saree",
    slug: "kanjeevaram-style-silk-saree",
    category: "silk-sarees",
    description: "Temple-border Kanjeevaram style silk with a woven golden contrast pallu.",
    details:
      "Inspired by the grand weaves of Kanchipuram, this saree brings temple motifs and a thick gold-tissue pallu to an everyday budget. The sturdy silk blend holds pleats beautifully and needs no ironing before a big day.\n\nIncludes unstitched blouse piece.",
    fabric: "Silk-blend with zari border",
    occasion: "Weddings · Pooja · Celebrations",
    colorway: "Forest Green",
    colors: ["Forest Green", "Maroon", "Mustard Yellow", "Ivory Cream"],
    rating: 4.7,
    reviewCount: 96,
    tags: ["bestseller"],
    featured: true,
    createdAt: "2026-05-02",
  }),
  product({
    id: "sil-03",
    name: "Banarasi Georgette Silk Saree",
    slug: "banarasi-georgette-silk-saree",
    category: "silk-sarees",
    description: "Light Banarasi weave with a shimmering gold pallu — comfort meets ceremony.",
    details:
      "All the drama of Banarasi with half the weight. A featherlight georgette-silk blend lets the gold floral jaal and scalloped pallu move with you from mehendi to reception.\n\nComes with unstitched blouse piece.",
    fabric: "Georgette-silk blend with zari",
    occasion: "Sangeet · Receptions · Festive",
    colorway: "Blush Pink",
    colors: ["Blush Pink", "Ivory Cream", "Navy Blue", "Maroon"],
    rating: 4.6,
    reviewCount: 71,
    tags: ["new"],
    createdAt: "2026-08-25",
  }),
  product({
    id: "sil-04",
    name: "South Silk Temple Saree",
    slug: "south-silk-temple-saree",
    category: "silk-sarees",
    description: "Traditional temple-border silk in deep jewel tones.",
    details:
      "A classic South Indian drape with repeating temple gopuram motifs along a wide border. The stiff-but-soft silk blend holds its shape, while the contrast pallu adds old-world grandeur.\n\nUnstitched blouse piece included.",
    fabric: "Tussar-style silk blend",
    occasion: "Weddings · Temple · Festive",
    colorway: "Deep Green",
    colors: ["Deep Green", "Maroon", "Plum", "Mustard Yellow"],
    rating: 4.5,
    reviewCount: 54,
    createdAt: "2026-03-11",
  }),
  product({
    id: "sil-05",
    name: "Silk Zari Fancy Border Saree",
    slug: "silk-zari-fancy-border-saree",
    category: "silk-sarees",
    description: "Party silk with an all-over zari-woven fancy border.",
    details:
      "For evenings that call for shimmer: a glossy silk body etched with delicate gold motifs and a broad fancy border that catches every light.\n\nDry clean only. Blouse piece included.",
    fabric: "Art silk with zari",
    occasion: "Parties · Cocktails · Festive",
    colorway: "Mustard Yellow",
    colors: ["Mustard Yellow", "Blush Pink", "Teal", "Maroon"],
    rating: 4.4,
    reviewCount: 38,
    createdAt: "2026-01-22",
  }),

  // ------------------------------ Cotton ------------------------------
  product({
    id: "cot-01",
    name: "Soft Daily-wear Cotton Saree",
    slug: "soft-daily-wear-cotton-saree",
    category: "cotton-sarees",
    description: "Featherlight everyday cotton that feels like a second skin.",
    details:
      "Woven from fine combed cotton, this saree is airy, absorbent and kind to your skin through long summer days. A discreet self-border keeps it office-ready, and the fabric softens further with every wash.\n\nBlouse piece included. Machine wash cold.",
    fabric: "100% combed cotton",
    occasion: "Office · Everyday · Summer",
    colorway: "Ivory Cream",
    colors: ["Ivory Cream", "Maroon", "Forest Green"],
    rating: 4.7,
    reviewCount: 214,
    tags: ["bestseller"],
    featured: true,
    createdAt: "2026-02-14",
  }),
  product({
    id: "cot-02",
    name: "Handloom Chettinad Cotton Saree",
    slug: "handloom-chettinad-cotton-saree",
    category: "cotton-sarees",
    description: "Chettinad-inspired checked weave with a bold contrast border.",
    details:
      "The unmistakable Chettinad check, hand-woven into sturdy everyday cotton and finished with a contrasting border and tiny temple accents. Gets softer, never weaker, wash after wash.\n\nBlouse piece included.",
    fabric: "Handloom cotton",
    occasion: "Everyday · Office · Casual",
    colorway: "Rust Orange",
    colors: ["Rust Orange", "Forest Green", "Indigo Blue"],
    rating: 4.6,
    reviewCount: 168,
    tags: ["bestseller"],
    createdAt: "2026-06-08",
  }),
  product({
    id: "cot-03",
    name: "Bandhani Inspired Cotton Saree",
    slug: "bandhani-inspired-cotton-saree",
    category: "cotton-sarees",
    description: "Jaipur bandhani dots sprinkled over breezy pastel cotton.",
    details:
      "Delicate tie-and-dye dots, the way Jaipur has made them for generations, printed onto light cotton that keeps you cool from morning market to evening chai.\n\nBlouse piece included.",
    fabric: "Fine cotton with bandhani print",
    occasion: "Day wear · Festive · Casual",
    colorway: "Blush Pink",
    colors: ["Blush Pink", "Mustard Yellow", "Teal"],
    rating: 4.5,
    reviewCount: 89,
    createdAt: "2026-04-19",
  }),
  product({
    id: "cot-04",
    name: "Cotton Silk Festive Saree",
    slug: "cotton-silk-festive-saree",
    category: "cotton-sarees",
    description: "The sheen of silk with the comfort of cotton for festive days.",
    details:
      "Cotton-silk is the easy answer to Indian festivals: it drapes like silk, breathes like cotton and carries zari borders that glint without glare.\n\nBlouse piece included.",
    fabric: "Cotton-silk blend",
    occasion: "Festivals · Pooja · Day events",
    colorway: "Mustard Yellow",
    colors: ["Mustard Yellow", "Ivory Cream", "Plum"],
    rating: 4.6,
    reviewCount: 77,
    tags: ["new"],
    createdAt: "2026-08-05",
  }),
  product({
    id: "cot-05",
    name: "Kalamkari Print Cotton Saree",
    slug: "kalamkari-print-cotton-saree",
    category: "cotton-sarees",
    description: "Hand-drawn Kalamkari storytelling motifs on soft cotton.",
    details:
      "Inspired by the temple paintings of Andhra, this Kalamkari print pairs earthy colourways with a gentle muslin-feel cotton — art you can wear to work.\n\nBlouse piece included.",
    fabric: "Soft cotton with Kalamkari print",
    occasion: "Office · Art events · Casual",
    colorway: "Teal",
    colors: ["Teal", "Rust Orange", "Indigo Blue"],
    rating: 4.4,
    reviewCount: 41,
    createdAt: "2026-01-30",
  }),
  product({
    id: "cot-06",
    name: "Everyday Silk-mark Cotton Saree",
    slug: "everyday-silk-mark-cotton-saree",
    category: "cotton-sarees",
    description: "Trusted silk-mark cotton in a timeless deep maroon.",
    details:
      "The saree your mother wore, re-woven for you: fine silk-mark cotton in a deep, dignified maroon with a narrow gold-thread border. Easy to drape, easy to live in.\n\nBlouse piece included.",
    fabric: "Silk-mark pure cotton",
    occasion: "Everyday · Office · Functions",
    colorway: "Maroon",
    colors: ["Maroon", "Forest Green", "Navy Blue"],
    rating: 4.8,
    reviewCount: 133,
    tags: ["bestseller"],
    createdAt: "2026-02-27",
  }),

  // ------------------------------ Printed ------------------------------
  product({
    id: "prt-01",
    name: "Floral Printed Saree",
    slug: "floral-printed-saree",
    category: "printed-sarees",
    description: "Fresh florals on featherlight fabric for easy everyday style.",
    details:
      "An all-over garden of soft florals — roses, buds and trailing vines — printed in watercolour tones that flatter every skin shade. The light crepe body falls in clean pleats and needs no fussing.\n\nBlouse piece included.",
    fabric: "Soft crepe with digital print",
    occasion: "Day wear · Office · Casual",
    colorway: "Forest Green",
    colors: ["Forest Green", "Blush Pink", "Navy Blue"],
    rating: 4.7,
    reviewCount: 187,
    tags: ["bestseller", "new"],
    featured: true,
    createdAt: "2026-08-12",
  }),
  product({
    id: "prt-02",
    name: "Pastel Abstract Printed Saree",
    slug: "pastel-abstract-printed-saree",
    category: "printed-sarees",
    description: "Watercolour abstracts in calm pastels — modern and easy.",
    details:
      "Soft washes of colour drift across the body like monsoon clouds. A quiet, contemporary print that works for college, work and weekend brunches alike.\n\nBlouse piece included.",
    fabric: "Crepe with abstract print",
    occasion: "Casual · Office · Day out",
    colorway: "Blush Pink",
    colors: ["Blush Pink", "Teal", "Ivory Cream"],
    rating: 4.5,
    reviewCount: 63,
    createdAt: "2026-05-25",
  }),
  product({
    id: "prt-03",
    name: "Temple Border Printed Saree",
    slug: "temple-border-printed-saree",
    category: "printed-sarees",
    description: "Printed body, woven-look temple border — festive at a fraction of the cost.",
    details:
      "A digitally printed body in rich colourways finished with a wide temple-motif border that mimics hand-weave so closely guests will ask where the loom is.\n\nBlouse piece included.",
    fabric: "Chiffon-touch poly with temple print",
    occasion: "Festivals · Pooja · Functions",
    colorway: "Maroon",
    colors: ["Maroon", "Mustard Yellow", "Deep Green"],
    rating: 4.6,
    reviewCount: 92,
    createdAt: "2026-03-03",
  }),
  product({
    id: "prt-04",
    name: "Mango Motif Printed Saree",
    slug: "mango-motif-printed-saree",
    category: "printed-sarees",
    description: "Paisley mango motifs with a metallic sheen for festive evenings.",
    details:
      "The classic paisley gets a metallic upgrade: gold-toned mango motifs printed over a soft ground, finished with a shimmer border. Festive enough for Diwali, light enough for every day of it.\n\nBlouse piece included.",
    fabric: "Metallic-print georgette",
    occasion: "Festive · Parties · Diwali",
    colorway: "Plum",
    colors: ["Plum", "Navy Blue", "Maroon"],
    rating: 4.5,
    reviewCount: 58,
    createdAt: "2026-06-30",
  }),
  product({
    id: "prt-05",
    name: "Bold Block Print Cotton Saree",
    slug: "bold-block-print-cotton-saree",
    category: "printed-sarees",
    description: "Hand-block florals in mustard — the print that never dates.",
    details:
      "Block-printed by hand with wooden stamps, this mustard-base saree carries generous florals and a contrasting navy border. Each piece has the tiny irregularities that prove it's handmade.\n\nBlouse piece included.",
    fabric: "Hand-block printed cotton",
    occasion: "Everyday · Ethnic day · Casual",
    colorway: "Mustard Yellow",
    colors: ["Mustard Yellow", "Indigo Blue", "Rust Orange"],
    rating: 4.7,
    reviewCount: 81,
    createdAt: "2026-04-04",
  }),

  // ------------------------------ Chiffon ------------------------------
  product({
    id: "chi-01",
    name: "Featherlight Chiffon Saree",
    slug: "featherlight-chiffon-saree",
    category: "chiffon-sarees",
    description: "Semi-sheer chiffon that floats — with a delicate self border.",
    details:
      "Chiffon's signature is a weightless fall, and this one delivers: softly translucent, gently lustrous and trimmed with a fine tone-on-tone border. Ideal for summer evenings and long celebrations.\n\nBlouse piece included.",
    fabric: "Premium chiffon",
    occasion: "Evenings · Parties · Summer",
    colorway: "Indigo Blue",
    colors: ["Indigo Blue", "Blush Pink", "Teal"],
    rating: 4.5,
    reviewCount: 74,
    createdAt: "2026-07-16",
  }),
  product({
    id: "chi-02",
    name: "Chiffon Zari Border Saree",
    slug: "chiffon-zari-border-saree",
    category: "chiffon-sarees",
    description: "Flowing chiffon anchored by a woven gold zari border.",
    details:
      "The best of both worlds — the soft movement of chiffon with the ceremony of zari. A lustrous gold border runs the length of the saree and widens at the pallu for a graceful finish.\n\nBlouse piece included.",
    fabric: "Chiffon with zari border",
    occasion: "Festivals · Weddings · Receptions",
    colorway: "Maroon",
    colors: ["Maroon", "Forest Green", "Navy Blue", "Plum"],
    rating: 4.8,
    reviewCount: 119,
    tags: ["bestseller"],
    featured: true,
    createdAt: "2026-05-19",
  }),
  product({
    id: "chi-03",
    name: "Pastel Sheer Chiffon Saree",
    slug: "pastel-sheer-chiffon-saree",
    category: "chiffon-sarees",
    description: "Whisper-soft pastel chiffon for serene, elegant days.",
    details:
      "A barely-there pastel that layers beautifully over a contrast blouse — the modern way to wear chiffon. Falls like water, packs like a dream.\n\nBlouse piece included.",
    fabric: "Sheer chiffon",
    occasion: "Day events · Bridal showers · Casual festive",
    colorway: "Blush Pink",
    colors: ["Blush Pink", "Ivory Cream", "Teal"],
    rating: 4.3,
    reviewCount: 36,
    tags: ["new"],
    createdAt: "2026-08-29",
  }),
  product({
    id: "chi-04",
    name: "Chiffon Printed Drape Saree",
    slug: "chiffon-printed-drape-saree",
    category: "chiffon-sarees",
    description: "A soft floral drift across sheer chiffon — office to outing.",
    details:
      "Fine florals printed over sheer chiffon create a watercolour depth that shifts as you move. Light, cool and endlessly flattering.\n\nBlouse piece included.",
    fabric: "Printed sheer chiffon",
    occasion: "Office · Outings · Casual",
    colorway: "Teal",
    colors: ["Teal", "Indigo Blue", "Mustard Yellow"],
    rating: 4.4,
    reviewCount: 47,
    createdAt: "2026-02-09",
  }),

  // ------------------------------ Georgette ------------------------------
  product({
    id: "geo-01",
    name: "Georgette Designer Saree",
    slug: "georgette-designer-saree",
    category: "georgette-sarees",
    description: "Designer georgette with an embellished border and rich drape.",
    details:
      "A full-bodied georgette that drapes in sharp, clean pleats — the canvas for a designer border of woven florals and subtle shimmer. Made for the days you want to be noticed.\n\nBlouse piece included.",
    fabric: "Premium georgette",
    occasion: "Parties · Receptions · Evening events",
    colorway: "Navy Blue",
    colors: ["Navy Blue", "Maroon", "Plum"],
    rating: 4.6,
    reviewCount: 156,
    tags: ["bestseller"],
    createdAt: "2026-06-21",
  }),
  product({
    id: "geo-02",
    name: "Georgette Silk Blend Saree",
    slug: "georgette-silk-blend-saree",
    category: "georgette-sarees",
    description: "Georgette's drape with silk's sheen — an everyday luxe feel.",
    details:
      "A whisper of silk woven into georgette gives this saree a soft glow that photographs beautifully, from office festive days to evening functions.\n\nBlouse piece included.",
    fabric: "Georgette-silk blend",
    occasion: "Office festive · Functions · Parties",
    colorway: "Forest Green",
    colors: ["Forest Green", "Mustard Yellow", "Maroon"],
    rating: 4.5,
    reviewCount: 66,
    createdAt: "2026-03-22",
  }),
  product({
    id: "geo-03",
    name: "Georgette Floral Fancy Saree",
    slug: "georgette-floral-fancy-saree",
    category: "georgette-sarees",
    description: "Fancy floral georgette for festive brunches and evenings.",
    details:
      "Oversized florals in deep, rich colourways give this georgette a modern-festive energy. Pair with gold jewellery and you're ready.\n\nBlouse piece included.",
    fabric: "Printed georgette",
    occasion: "Festivals · Brunches · Parties",
    colorway: "Rust Orange",
    colors: ["Rust Orange", "Blush Pink", "Deep Green"],
    rating: 4.4,
    reviewCount: 52,
    createdAt: "2026-07-07",
  }),
  product({
    id: "geo-04",
    name: "Pearl Border Georgette Saree",
    slug: "pearl-border-georgette-saree",
    category: "georgette-sarees",
    description: "Pearl-studded border on a soft matte georgette.",
    details:
      "Rows of pearl-toned sequins trace the border of this matte georgette, catching candlelight at sangeet and reception alike without ever shouting.\n\nBlouse piece included.",
    fabric: "Georgette with pearl sequin border",
    occasion: "Sangeet · Receptions · Weddings",
    colorway: "Ivory Cream",
    colors: ["Ivory Cream", "Blush Pink", "Maroon"],
    rating: 4.7,
    reviewCount: 88,
    tags: ["new"],
    createdAt: "2026-08-21",
  }),

  // ------------------------------ Fancy ------------------------------
  product({
    id: "fan-01",
    name: "Designer Party Wear Saree",
    slug: "designer-party-wear-saree",
    category: "fancy-sarees",
    description: "Sequined fancy saree built for the dance floor.",
    details:
      "A fine scatter of sequins across the body keeps this party saree sparkling at every angle, while the crepe base stays smooth and easy to manage through a long night.\n\nBlouse piece included.",
    fabric: "Sequined crepe",
    occasion: "Parties · Sangeet · Celebrations",
    colorway: "Maroon",
    colors: ["Maroon", "Mustard Yellow", "Plum"],
    rating: 4.5,
    reviewCount: 94,
    tags: ["bestseller"],
    createdAt: "2026-05-30",
  }),
  product({
    id: "fan-02",
    name: "Net Fancy Saree with Lace",
    slug: "net-fancy-saree-with-lace",
    category: "fancy-sarees",
    description: "Sheer net saree with lace and a sequinned scalloped border.",
    details:
      "Layered sheer net with delicate lace inserts and a scalloped sequin border make this saree the centre of any frame. Layer over a contrast blouse and let the net do the talking.\n\nBlouse piece included.",
    fabric: "Net with lace and sequins",
    occasion: "Cocktails · Sangeet · Receptions",
    colorway: "Teal",
    colors: ["Teal", "Blush Pink", "Indigo Blue"],
    rating: 4.6,
    reviewCount: 60,
    createdAt: "2026-04-27",
  }),
  product({
    id: "fan-03",
    name: "Golden Tissue Fancy Saree",
    slug: "golden-tissue-fancy-saree",
    category: "fancy-sarees",
    description: "Gossamer tissue saree with an all-gold shimmer.",
    details:
      "Tissue is the fabric of bridal season: gossamer-light, alive with metallic threads and finished with a woven gold border. Wear it to every wedding on the calendar — it earns its keep.\n\nBlouse piece included.",
    fabric: "Tissue with metallic threads",
    occasion: "Weddings · Receptions · Big days",
    colorway: "Mustard Yellow",
    colors: ["Mustard Yellow", "Maroon", "Ivory Cream"],
    rating: 4.7,
    reviewCount: 102,
    tags: ["bestseller", "new"],
    createdAt: "2026-08-15",
  }),
  product({
    id: "fan-04",
    name: "Mirror Work Fancy Saree",
    slug: "mirror-work-fancy-saree",
    category: "fancy-sarees",
    description: "Rajasthani mirror work that dances in the light.",
    details:
      "Small round mirrors and gold thread, applied by hand, sparkle across this festive saree — pure Rajasthan, ready for garba, mehendi and every celebration in between.\n\nBlouse piece included.",
    fabric: "Cotton base with mirror embroidery",
    occasion: "Garba · Mehendi · Festive nights",
    colorway: "Indigo Blue",
    colors: ["Indigo Blue", "Rust Orange", "Maroon"],
    rating: 4.6,
    reviewCount: 69,
    createdAt: "2026-06-12",
  }),
];

/** Lightweight slug -> labels map. Safe to bundle client-side (no big fields). */
export const PRODUCT_INDEX: Record<
  string,
  { name: string; category: string; colorway: string }
> = Object.fromEntries(
  PRODUCTS.map((p) => [p.slug, { name: p.name, category: p.category, colorway: p.colorway }]),
);

/** Slugs known to the catalogue (server-side validation). */
export const KNOWN_SLUGS: Set<string> = new Set(PRODUCTS.map((p) => p.slug));
