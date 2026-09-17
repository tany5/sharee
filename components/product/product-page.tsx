"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Minus,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Zap,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { artForProduct } from "@/lib/art";
import { productPhoto, productPhotoAlt } from "@/lib/photos";
import SareeArt from "@/components/product/saree-art";
import { ProductGrid } from "@/components/product/product-grid";
import { Button, Stars } from "@/components/ui";
import { useCart } from "@/components/store/providers";
import { trackAddToCart, trackViewContent } from "@/lib/analytics";
import { formatINR } from "@/lib/format";
import { swatchFor } from "@/lib/color-dots";
import { cx } from "@/lib/utils";

interface ProductPageProps {
  product: Product;
  related: Product[];
}

const FEATURES = [
  { Icon: ShieldCheck, title: "Quality Assured", sub: "Best fabric & finishing" },
  { Icon: RotateCcw, title: "Easy Returns", sub: "7-day hassle-free returns" },
  { Icon: Truck, title: "Fast Delivery", sub: "3–5 days across India" },
];

const SAMPLE_REVIEWS = [
  {
    name: "Priya S.",
    place: "Mumbai",
    rating: 5,
    text: "Honestly could not believe the price when it arrived — the fabric and finishing feel like something you'd pay 10x for. Drapes beautifully.",
  },
  {
    name: "Anjali M.",
    place: "Bengaluru",
    rating: 5,
    text: "Ordered three for a family function. Delivery was quick, colours matched the photos exactly and the blouse piece was a lovely surprise.",
  },
  {
    name: "Kavya R.",
    place: "Jaipur",
    rating: 4,
    text: "Soft, breathable cotton — perfect for daily wear. Returns are easy if you need them, but I doubt you will.",
  },
];

function imagePoseRank(url: string): number {
  const text = url.toLowerCase();
  if (/(^|[-_/])front[-_/.]/.test(text)) return 0;
  if (/(^|[-_/])side[-_/.]/.test(text)) return 1;
  if (/(^|[-_/])back[-_/.]/.test(text)) return 2;
  if (/(^|[-_/])full[-_]?saree[-_/.]/.test(text)) return 3;
  return 4;
}

export function ProductPage({ product, related }: ProductPageProps) {
  const router = useRouter();
  const { add } = useCart();

  const [colorIdx, setColorIdx] = useState(0);
  const [viewIdx, setViewIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [zoomPos, setZoomPos] = useState<{ x: number; y: number } | null>(null);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Some admin/Supabase rows arrive without a colors array — fall back to the
  // product's colourway so the PDP never renders without a selected colour.
  const colors =
    product.colors.length > 0 ? product.colors.slice(0, 4) : [product.colorway];
  const selectedColor =
    colors[Math.min(colorIdx, colors.length - 1)] ?? product.colorway;
  const maxQty = Math.min(product.stock, 5);

  const specs = [
    { label: "Fabric", value: product.fabric },
    { label: "Colour", value: selectedColor },
    { label: "Occasion", value: product.occasion },
    { label: "Length", value: "5.5 m + unstitched blouse piece" },
  ];

  const modelPhoto = productPhoto(product.slug);
  const altPhoto = productPhotoAlt(product.slug);

  // Admin-uploaded/generated product images are the source of truth. Seeded
  // stock photos and SVG art are only fallbacks for catalogue rows with no
  // saved images yet.
  const galleryViews = useMemo(() => {
    const views: {
      kind: "photo" | "art";
      src?: string;
      spec?: ReturnType<typeof artForProduct>;
    }[] = [];
    for (const src of [...(product.images ?? [])].sort((a, b) => imagePoseRank(a) - imagePoseRank(b))) {
      if (src && !views.some((view) => view.src === src)) {
        views.push({ kind: "photo", src });
      }
    }
    if (views.length === 0) {
      if (modelPhoto) views.push({ kind: "photo", src: modelPhoto });
      if (altPhoto) views.push({ kind: "photo", src: altPhoto });
      const artStart = views.length;
      views.push({
        kind: "art",
        spec: artForProduct(product.slug, product.colorway, product.category, artStart),
      });
      views.push({
        kind: "art",
        spec: artForProduct(product.slug, product.colorway, product.category, artStart + 1),
      });
    }
    return views.slice(0, 6);
  }, [modelPhoto, altPhoto, product.images, product.slug, product.colorway, product.category]);

  const activeView = Math.min(viewIdx, galleryViews.length - 1);

  // ViewContent: product page opened (fires once per page view).
  useEffect(() => {
    trackViewContent(product.slug, product.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

  const cartImage =
    product.images?.[0] ??
    (galleryViews.find((view) => view.kind === "photo" && view.src)?.src);

  const doAdd = (thenCheckout: boolean) => {
    add(product.slug, selectedColor, qty, {
      name: product.name,
      price: product.price,
      image: cartImage,
    });
    trackAddToCart(product.slug, product.name, qty);
    setAdded(true);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAdded(false), 1600);
    if (thenCheckout) router.push("/checkout");
  };

  const paragraphs = useMemo(() => product.details.split(/\n\n+/), [product.details]);
  const activePhotoSrc =
    galleryViews[activeView]?.kind === "photo" ? galleryViews[activeView].src : undefined;

  const updateZoom = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!activePhotoSrc) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoomPos({
      x: Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100)),
    });
  };

  return (
    <div>
      {/* Main section */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-10 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-12 lg:pt-8">
        {/* Gallery */}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <div className="flex gap-3 sm:flex-col">
            {galleryViews.map((view, i) => {
              const active = i === activeView;
              return (
                <button
                  key={`${i}-${view.kind}`}
                  type="button"
                  onClick={() => setViewIdx(i)}
                  aria-label={
                    view.kind === "photo"
                      ? `View ${product.name} worn photo ${i === 0 ? 1 : 2}`
                      : `View the saree alone, style ${i + 1}`
                  }
                  className={cx(
                    "h-20 w-16 shrink-0 overflow-hidden rounded-lg ring-1 transition-all sm:h-24 sm:w-20",
                    active
                      ? "ring-2 ring-accent"
                      : "ring-line opacity-70 hover:opacity-100",
                  )}
                >
                  {view.kind === "photo" && view.src ? (
                    <Image
                      src={view.src}
                      alt={`${product.name} worn by model`}
                      width={96}
                      height={128}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : view.spec ? (
                    <SareeArt spec={view.spec} crop="portrait" className="h-full w-full" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            className="group relative aspect-[3/4] flex-1 rounded-2xl ring-1 ring-line"
            onMouseMove={updateZoom}
            onMouseLeave={() => setZoomPos(null)}
          >
            {galleryViews[activeView]?.kind === "photo" && galleryViews[activeView].src ? (
              <Image
                src={galleryViews[activeView].src!}
                alt={`${product.name} saree at ₹199 — ${selectedColor.toLowerCase()} — worn by model`}
                fill
                sizes="(min-width: 1024px) 55vw, 100vw"
                priority
                className="rounded-2xl object-cover object-top"
              />
            ) : galleryViews[activeView]?.spec ? (
              <SareeArt
                spec={galleryViews[activeView].spec}
                label={`${product.name} saree at ₹199 — ${selectedColor.toLowerCase()}`}
                className="absolute inset-0 h-full w-full overflow-hidden rounded-2xl"
              />
            ) : null}
            {activePhotoSrc && (
              <>
                {zoomPos && (
                  <>
                    <div
                      className="pointer-events-none absolute z-20 hidden h-36 w-44 -translate-x-1/2 -translate-y-1/2 border border-accent/80 bg-accent/15 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] outline outline-1 outline-dashed outline-white/70 md:block"
                      style={{
                        left: `${zoomPos.x}%`,
                        top: `${zoomPos.y}%`,
                      }}
                    />
                    <div
                      className="pointer-events-none absolute left-[calc(100%+1rem)] top-0 z-40 hidden h-[min(72vh,42rem)] w-[min(48vw,44rem)] overflow-hidden rounded-xl border border-line bg-surface bg-no-repeat shadow-2xl xl:block"
                      style={{
                        backgroundImage: `url("${activePhotoSrc}")`,
                        backgroundSize: "260%",
                        backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                      }}
                    />
                  </>
                )}
              </>
            )}
            {galleryViews.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setViewIdx((activeView - 1 + galleryViews.length) % galleryViews.length)}
                  aria-label="Previous image"
                  className="absolute left-2.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-md opacity-0 backdrop-blur transition-opacity duration-200 hover:bg-surface group-hover:opacity-100 md:flex"
                >
                  <ChevronLeft size={17} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewIdx((activeView + 1) % galleryViews.length)}
                  aria-label="Next image"
                  className="absolute right-2.5 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface/90 text-ink shadow-md opacity-0 backdrop-blur transition-opacity duration-200 hover:bg-surface group-hover:opacity-100 md:flex"
                >
                  <ChevronRight size={17} strokeWidth={2.2} />
                </button>
              </>
            )}
            <span className="absolute left-3 top-3 rounded-full bg-accentdeep px-3 py-1.5 font-display text-sm font-bold text-white shadow-md">
              {formatINR(product.price)}
            </span>
            {product.stock <= 10 && (
              <span className="absolute right-3 top-3 rounded-full bg-surface/95 px-3 py-1 text-[11px] font-semibold text-danger shadow-sm backdrop-blur">
                Only {product.stock} left
              </span>
            )}
          </div>
        </div>

        {/* Buy panel */}
        <div className="flex flex-col">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">
            {product.category.replace("-sarees", " sarees")}
          </p>
          <h1 className="mt-1.5 text-3xl leading-tight text-ink sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Stars rating={product.rating} size={16} />
            <span className="text-sm text-muted">({product.reviewCount} reviews)</span>
            <span className="flex items-center gap-1 text-sm font-semibold text-success">
              <BadgeCheck size={15} />
              In stock · ships in 24h
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <p className="font-display text-[40px] font-bold leading-none text-ink sm:text-5xl">
              {formatINR(product.price)}
            </p>
            {product.compareAt ? (
              <s className="text-lg text-muted">{formatINR(product.compareAt)}</s>
            ) : null}
          </div>
          <p className="mt-1.5 text-[13px] text-muted">(Inclusive of all taxes)</p>

          <p className="mt-5 text-[15px] leading-6 text-ink2">{product.description}</p>

          {/* Colour selector */}
          <div className="mt-6">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-ink">
              Colour: <span className="normal-case tracking-normal">{selectedColor}</span>
            </p>
            <div className="flex gap-2.5" role="radiogroup" aria-label="Colour">
              {colors.map((c, i) => {
                const active = i === colorIdx;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setColorIdx(i);
                      // Land back on the model photo; artwork variants are for browsing.
                      setViewIdx(0);
                    }}
                    title={c}
                    className={cx(
                      "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                      active ? "border-accent ring-2 ring-accent/50" : "border-line hover:border-accent/60",
                    )}
                  >
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: swatchFor(c) }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Qty + actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <div className="flex h-12 items-center rounded-full border border-line bg-surface">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                aria-label="Decrease quantity"
                className="flex h-full w-11 items-center justify-center text-ink2 hover:text-ink"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center text-[15px] font-bold text-ink" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                aria-label="Increase quantity"
                disabled={qty >= maxQty}
                className="flex h-full w-11 items-center justify-center text-ink2 hover:text-ink disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </div>
            <Button size="lg" className="min-w-44 flex-1 sm:flex-none" onClick={() => doAdd(false)}>
              {added ? (
                <>
                  <Check size={18} /> Added to cart
                </>
              ) : (
                <>
                  <ShoppingCart size={18} /> Add to Cart
                </>
              )}
            </Button>
            <Button size="lg" variant="outline" className="min-w-40 flex-1 sm:flex-none" onClick={() => doAdd(true)}>
              <Zap size={17} /> Buy Now
            </Button>
          </div>

          {/* Feature bullets */}
          <ul className="mt-7 grid grid-cols-1 gap-3 border-t border-line pt-6 sm:grid-cols-3">
            {FEATURES.map(({ Icon, title, sub }) => (
              <li key={title} className="flex items-start gap-2.5">
                <Icon size={20} className="mt-0.5 shrink-0 text-bronze" />
                <div>
                  <p className="text-[13px] font-bold text-ink">{title}</p>
                  <p className="text-xs text-muted">{sub}</p>
                </div>
              </li>
            ))}
          </ul>

          {/* Specs */}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-2xl border border-line bg-surface p-5">
            {specs.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted">{s.label}</dt>
                <dd className="mt-0.5 truncate text-sm font-semibold text-ink" title={s.value}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Description */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl rounded-3xl border border-line bg-surface px-6 py-8 sm:px-10">
          <h2 className="text-xl text-ink">About this saree</h2>
          <div className="mt-3 space-y-4 text-[15px] leading-7 text-ink2">
            {paragraphs.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section className="mx-auto mt-12 max-w-7xl px-4 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-3xl border border-line bg-surface p-6 text-center lg:text-left">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Customer reviews</p>
            <p className="mt-2 font-display text-5xl font-bold text-ink">{product.rating}</p>
            <div className="mt-2 flex justify-center lg:justify-start">
              <Stars rating={product.rating} size={18} />
            </div>
            <p className="mt-2 text-sm text-muted">
              Based on {product.reviewCount} verified buyers
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {SAMPLE_REVIEWS.map((r) => (
              <figure key={r.name} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
                <Stars rating={r.rating} size={13} />
                <blockquote className="mt-3 flex-1 text-sm leading-6 text-ink2">“{r.text}”</blockquote>
                <figcaption className="mt-4 text-[13px] font-bold text-ink">
                  {r.name} <span className="font-normal text-muted">· {r.place}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
          <h2 className="mb-6 text-2xl text-ink">You may also like</h2>
          <ProductGrid products={related} />
        </section>
      )}

      {/* Sticky mobile/desktop buy bar */}
      <StickyBuyBar
        price={product.price}
        stockLeft={product.stock <= 10 ? product.stock : null}
        added={added}
        onAdd={() => doAdd(false)}
        onBuy={() => doAdd(true)}
      />
    </div>
  );
}

function StickyBuyBar({
  price,
  stockLeft,
  added,
  onAdd,
  onBuy,
}: {
  price: number;
  stockLeft: number | null;
  added: boolean;
  onAdd: () => void;
  onBuy: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/90 md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-2.5" style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-14 flex-col items-start justify-center pr-2"
          aria-expanded={open}
          aria-label="Show delivery details"
        >
          <span className="font-display text-xl font-bold leading-none text-ink">
            {formatINR(price)}
          </span>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
            <ChevronDown size={11} className={cx("transition-transform", open && "rotate-180")} />
            Free shipping ₹999+
          </span>
        </button>
        <div className="flex-1" />
        <Button
          size="md"
          className="flex-1"
          onClick={onAdd}
          aria-live="polite"
        >
          {added ? (
            <>
              <Check size={17} /> Added
            </>
          ) : (
            <>
              <ShoppingCart size={17} /> Add to Cart
            </>
          )}
        </Button>
        <Button size="md" variant="outline" className="flex-none" onClick={onBuy} aria-label="Buy now">
          <Zap size={17} />
        </Button>
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3 text-xs text-ink2">
          <p className="flex items-center gap-1.5">
            <Clock size={13} className="text-bronze" /> Est. delivery: 3–5 working days · COD available
          </p>
          {stockLeft !== null && (
            <p className="mt-1.5 flex items-center gap-1.5 text-danger">Only {stockLeft} left in stock</p>
          )}
          <p className="mt-1.5">
            <Link href="/shipping-policy" className="text-accent underline">Shipping & returns</Link>
          </p>
        </div>
      )}
    </div>
  );
}
