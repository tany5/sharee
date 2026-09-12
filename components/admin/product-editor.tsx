"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  Save,
  Tags,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { useToast } from "@/components/admin/toast";
import { AdminThumb, PageHeader } from "@/components/admin/shared";
import type { Category, DbStatus } from "@/lib/types";
import type { DbProduct } from "@/lib/demo/db";
import { parseMarketing } from "@/lib/marketing/types";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "saree"
  );
}

interface Draft {
  name: string;
  slug: string;
  category: string;
  dbStatus: DbStatus;
  price: string;
  compareAt: string;
  cost: string;
  stock: string;
  colorway: string;
  colorsText: string;
  fabric: string;
  occasion: string;
  description: string;
  details: string;
  tagsText: string;
  featured: boolean;
}

interface PendingUpload {
  previewUrl: string;
  file: File;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EMPTY: Draft = {
  name: "",
  slug: "",
  category: "cotton-sarees",
  dbStatus: "draft",
  price: "199",
  compareAt: "",
  cost: "",
  stock: "10",
  colorway: "Maroon",
  colorsText: "",
  fabric: "Cotton",
  occasion: "Festive",
  description: "",
  details: "",
  tagsText: "",
  featured: false,
};

function toDraft(row: DbProduct): Draft {
  return {
    name: row.name,
    slug: row.slug,
    category: row.category,
    dbStatus: row.dbStatus === "active" ? "active" : "draft",
    price: String(row.price),
    compareAt: row.compareAt ? String(row.compareAt) : "",
    cost: String(row.cost ?? ""),
    stock: String(row.stock),
    colorway: row.colorway,
    colorsText: row.colors?.join(", ") ?? "",
    fabric: row.fabric,
    occasion: row.occasion,
    description: row.description,
    details: row.details,
    tagsText: row.tags?.join(", ") ?? "",
    featured: row.featured,
  };
}

function chipClass(on: boolean): string {
  return on
    ? "bg-accent text-surface shadow-sm"
    : "bg-surface text-ink2 border border-line hover:border-accent/40";
}

export function ProductEditor({ slug }: { slug?: string }) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(slug);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(!editing);
  const [missing, setMissing] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState<{ done: number; total: number } | null>(null);
  const [garmentSource, setGarmentSource] = useState<string | null>(null);
  const [hasAiRenders, setHasAiRenders] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
  const [removedImageUrls, setRemovedImageUrls] = useState<string[]>([]);
  const aiPhotoUrlsRef = useRef<string[]>([]);
  const pendingUploadsRef = useRef<PendingUpload[]>([]);
  const autoStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const aiPhotoTotal = 4;

  /** While creating (slug untouched), typing the name keeps the slug in sync. */
  const setName = (value: string) => {
    setDraft((d) => {
      const next = { ...d, name: value };
      if (!editing && !slugTouched) next.slug = slugify(value);
      return next;
    });
  };

  useEffect(() => {
    let active = true;
    // Fetch categories in both modes; only look up the product row when editing.
    fetch("/api/admin/products", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok: boolean; products?: DbProduct[]; categories?: Category[] }>)
      .then((d) => {
        if (!active) return;
        if (!d.ok) throw new Error("Failed to load products");
        setCategories(d.categories ?? []);
        if (!editing) return;
        const row = (d.products ?? []).find((p) => p.slug === slug);
        if (!row) {
          setMissing(true);
          return;
        }
        const marketing = parseMarketing(row.marketing);
        const generatedUrls = new Set(marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? []);
        if (marketing.tryOn?.imageUrl) generatedUrls.add(marketing.tryOn.imageUrl);
        setDraft(toDraft(row));
        setImages(row.images ?? []);
        setPendingUploads([]);
        setRemovedImageUrls([]);
        setHasAiRenders(Boolean(marketing.tryOn?.renders?.length));
        setGarmentSource(
          marketing.tryOn?.garmentUrl ??
            row.images?.find((url) => !generatedUrls.has(url)) ??
            null,
        );
      })
      .catch(() => {
        if (active) setError("Could not load the product list");
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [editing, slug]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const margin = useMemo(() => {
    const price = Number(draft.price);
    const cost = draft.cost.trim() === "" ? Math.round(price * 0.5) : Number(draft.cost);
    if (!Number.isFinite(price) || price <= 0) return null;
    const validCost = Number.isFinite(cost) ? Math.max(0, cost) : 0;
    return { cost: validCost, pct: price > 0 ? Math.round(((price - validCost) / price) * 100) : 0 };
  }, [draft.price, draft.cost]);

  useEffect(() => {
    pendingUploadsRef.current = pendingUploads;
  }, [pendingUploads]);

  useEffect(() => {
    return () => {
      pendingUploadsRef.current.forEach((pending) => URL.revokeObjectURL(pending.previewUrl));
    };
  }, []);

  const uploadMediaFile = async (file: File): Promise<string> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/media", { method: "POST", body: form });
    const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
    if (!res.ok || !data.ok || !data.url) throw new Error(data.error ?? "Upload failed");
    return data.url;
  };

  const upload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG or WebP)");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setError("File must be under 8 MB");
      return;
    }
    setError(null);
    const previewUrl = URL.createObjectURL(file);
    setPendingUploads((prev) => [...prev, { previewUrl, file }]);
    setImages((prev) => (prev.length >= 6 ? [...prev.slice(0, 5), previewUrl] : [...prev, previewUrl]));
    setGarmentSource((prev) => prev ?? previewUrl);
  };

  const removePhoto = (url: string) => {
    setImages((prev) => {
      const next = prev.filter((u) => u !== url);
      setGarmentSource((current) => (current === url ? next[0] ?? null : current));
      return next;
    });
    setPendingUploads((prev) => {
      const pending = prev.find((item) => item.previewUrl === url);
      if (pending) URL.revokeObjectURL(pending.previewUrl);
      return prev.filter((item) => item.previewUrl !== url);
    });
    if (!url.startsWith("blob:")) {
      setRemovedImageUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));
    }
  };

  /**
   * Resumable generation loop: each POST generates only missing poses and
   * persists partial progress immediately. To replace a bad render, remove it
   * from the product, save, then run generation again.
   */
  const runGeneration = async () => {
    const source = garmentSource;
    if (!source) {
      const msg = "Upload a saree photo first";
      setError(msg);
      toast.error(msg);
      return;
    }
    if (source.startsWith("blob:")) {
      const msg = "Save the saree first, then generate model photos";
      setError(msg);
      toast.error(msg);
      return;
    }
    setAiBusy(true);
    setError(null);
    setAiProgress({ done: 0, total: aiPhotoTotal });
    let landed = 0;
    try {
      for (let round = 0; round < 1; round++) {
        const res = await fetch("/api/admin/products/generate-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            garmentUrl: source,
            name: draft.name.trim() || "Saree",
            slug: slugify(draft.slug || draft.name || "saree"),
            force: false,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          urls?: string[];
          done?: boolean;
          remaining?: string[];
          images?: string[];
          error?: string;
          /** Kaggle FLUX.2 job queued/running — the next round polls it. */
          pending?: boolean;
        };
        const generated = data.urls ?? [];
        if (generated.length > 0) {
          landed += generated.length;
          aiPhotoUrlsRef.current = [...aiPhotoUrlsRef.current, ...generated];
          setAiProgress({ done: Math.min(aiPhotoTotal, landed), total: aiPhotoTotal });
          setImages((prev) => {
            const keep = prev.filter((url) => !generated.includes(url));
            return [...generated, ...keep].slice(0, 8);
          });
          setHasAiRenders(true);
        }
        if (data.images && data.images.length > 0) {
          setImages(data.images);
          setGarmentSource((current) => {
            if (current && data.images!.includes(current)) return current;
            return data.images![0] ?? null;
          });
        }
        if (data.pending && generated.length === 0) {
          // Kaggle jobs can spend a long time installing/loading FLUX. Do not
          // keep the editor trapped in a polling loop; the next click collects
          // completed outputs.
          const msg = "Kaggle FLUX job is still running. You can leave this page and click Generate again later to collect the photos.";
          setError(msg);
          toast.info(msg, { duration: 9000 });
          break;
        }
        if (!res.ok || (!data.ok && generated.length === 0)) {
          throw new Error(data.error ?? "Could not generate model photos");
        }
        if (data.error && generated.length > 0) {
          // Partial success — keep what landed, surface the failure.
          toast.info(`Some photos need a retry: ${data.error}`, { duration: 8000 });
          break;
        }
        if (data.done || (data.remaining ?? []).length === 0) {
          toast.success(
            landed > 0
              ? `Generated ${landed} model wearing photo${landed === 1 ? "" : "s"}.`
              : "Model wearing photos are up to date.",
          );
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not generate model photos";
      setError(message);
      toast.error(message);
    } finally {
      setAiBusy(false);
      setAiProgress(null);
    }
  };

  /**
   * Auto-start generation right after creating a product (redirect carries
   * ?generate=1). Runs once, only when the product has a saree photo but no
   * model renders yet.
   */
  useEffect(() => {
    if (!editing || !loaded || autoStartedRef.current) return;
    if (typeof window === "undefined") return;
    if (!window.location.search.includes("generate=1")) return;
    if (images.length === 0) return; // product data still loading
    autoStartedRef.current = true;
    // Clear the flag so a refresh doesn't re-trigger.
    window.history.replaceState({}, "", window.location.pathname);
    const hasGarment = garmentSource !== null;
    const hasRenders = hasAiRenders;
    if (hasGarment && !hasRenders) {
      // Deferred so the effect body itself stays setState-free.
      const t = setTimeout(() => void runGeneration(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, loaded, images, garmentSource, hasAiRenders]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (draft.name.trim().length < 2) {
      setError("Give the saree a name");
      toast.error("Give the saree a name");
      return;
    }
    if (!editing && draft.slug.trim().length < 2) {
      setError("Choose a valid product slug");
      toast.error("Choose a valid product slug");
      return;
    }
    let finalImages = images;
    const uploaded = new Map<string, string>();

    setBusy(true);
    try {
      for (const pending of pendingUploads) {
        const url = await uploadMediaFile(pending.file);
        uploaded.set(pending.previewUrl, url);
        URL.revokeObjectURL(pending.previewUrl);
      }
      finalImages = images
        .map((url) => uploaded.get(url) ?? url)
        .filter((url) => !url.startsWith("blob:"));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setError(message);
      toast.error(message);
      setBusy(false);
      return;
    }

    const finalGarmentSource = garmentSource
      ? uploaded.get(garmentSource) ?? garmentSource
      : finalImages[0] ?? null;

    const body: Record<string, unknown> = {
      name: draft.name.trim(),
      slug: slugify(draft.slug || draft.name),
      category: draft.category,
      dbStatus: draft.dbStatus,
      price: Number(draft.price) || 199,
      compareAt: draft.compareAt.trim() ? Number(draft.compareAt) || 0 : undefined,
      cost: draft.cost.trim() === "" ? undefined : Number(draft.cost) || 0,
      stock: Number(draft.stock) || 0,
      colorway: draft.colorway.trim() || "Maroon",
      colors: draft.colorsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      fabric: draft.fabric.trim(),
      occasion: draft.occasion.trim(),
      description: draft.description.trim(),
      details: draft.details.trim(),
      tags: draft.tagsText
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
      featured: draft.featured,
      images: finalImages,
      removedImages: removedImageUrls,
    };

    try {
      const res = await fetch(
        editing ? `/api/admin/products/${slug}` : "/api/admin/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as {
        ok: boolean;
        product?: DbProduct;
        error?: string;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not save");
      toast.success(editing ? "Product updated." : "Product created.");
      setImages(finalImages);
      setGarmentSource(finalGarmentSource && !finalGarmentSource.startsWith("blob:") ? finalGarmentSource : finalImages[0] ?? null);
      setPendingUploads([]);
      setRemovedImageUrls([]);
      router.refresh();
      if (!editing) {
        // The new edit page auto-starts catalogue photo generation (?generate=1).
        const wantsPhotos = finalImages.length > 0;
        router.replace(
          `/admin/products/${data.product!.slug}${wantsPhotos ? "?generate=1" : ""}`,
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save";
      setError(message);
      toast.error(message);
      setBusy(false);
      return;
    }
    setBusy(false);
  };

  const deleteCurrentProduct = async () => {
    if (!editing || !slug) return;
    if (!window.confirm(`Delete "${draft.name || slug}"? It will be hidden from the store.`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not delete the product");
      toast.success(`"${draft.name || slug}" deleted.`);
      router.push("/admin/products");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete the product";
      setError(message);
      toast.error(message);
      setDeleting(false);
    }
  };

  /* ------------------------------ states ------------------------------ */

  if (editing && !loaded) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-8 w-64 animate-pulse rounded-full bg-surface2" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }

  if (missing) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
        <h1 className="text-2xl text-ink">Product not found</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink2">
          It may have been deleted. Return to the product list to pick another.
        </p>
        <Link
          href="/admin/products"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-btn px-5 text-[15px] font-semibold text-btntext"
        >
          <ArrowLeft size={16} /> Back to products
        </Link>
      </div>
    );
  }

  const statusOptions: { value: DbStatus; label: string; hint: string }[] = [
    { value: "draft", label: "Draft", hint: "Saved but hidden from the store" },
    { value: "active", label: "Live", hint: "Visible and buyable on the store" },
  ];

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader
        title={editing ? "Edit saree" : "Add a saree"}
        sub={editing ? `/${draft.slug}` : "New catalogue item — it stays a draft until you make it live."}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {editing && (
              <Button
                type="button"
                variant="outline"
                disabled={busy || aiBusy || deleting}
                onClick={deleteCurrentProduct}
                className="border-danger/40 text-danger hover:bg-danger/10"
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Delete
              </Button>
            )}
            <Link
              href="/admin/products"
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-accent/50 px-4 text-sm font-semibold text-ink transition-colors hover:bg-accent/10"
            >
              <ArrowLeft size={15} /> Cancel
            </Link>
            <Button type="submit" size="md" disabled={busy || deleting}>
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              {editing ? "Save product" : "Create saree & photos"}
            </Button>
          </div>
        }
      />

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ------------------------------ Left: core ------------------------------ */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg text-ink">
              <Tags size={17} className="text-bronze" /> Product details
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Name" required hint="Shown to customers">
                  <TextInput
                    value={draft.name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Banarasi Art Silk Saree"
                    autoFocus={!editing}
                  />
                </Field>
              </div>
              <Field label="Slug" required hint={editing ? "Fixed after creation" : "Auto from name"}>
                <TextInput
                  value={draft.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", slugify(e.target.value));
                  }}
                  readOnly={editing}
                  className={editing ? "opacity-60" : ""}
                  placeholder="banarasi-art-silk-saree"
                />
              </Field>
              <Field label="Category" required>
                <SelectInput
                  value={draft.category}
                  onChange={(e) => set("category", e.target.value)}
                >
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
              <Field label="Colour name" required hint="Shown under the price">
                <TextInput
                  value={draft.colorway}
                  onChange={(e) => set("colorway", e.target.value)}
                  placeholder="Maroon"
                />
              </Field>
              <Field label="Colour options" hint="Comma separated, e.g. Maroon, Green, Navy">
                <TextInput
                  value={draft.colorsText}
                  onChange={(e) => set("colorsText", e.target.value)}
                  placeholder="Maroon"
                />
              </Field>
              <Field label="Fabric" hint="Cotton, Silk, Georgette…">
                <TextInput
                  value={draft.fabric}
                  onChange={(e) => set("fabric", e.target.value)}
                  placeholder="Art Silk"
                />
              </Field>
              <Field label="Occasion" hint="Festive, Casual, Office…">
                <TextInput
                  value={draft.occasion}
                  onChange={(e) => set("occasion", e.target.value)}
                  placeholder="Festive"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Short description" hint="One line — cards and search">
                  <TextInput
                    value={draft.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Elegant Banarasi weave with rich zari pallu…"
                  />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Long description" hint="Full details shown on the product page">
                  <TextArea
                    value={draft.details}
                    onChange={(e) => set("details", e.target.value)}
                    className="min-h-28"
                    placeholder="Fabric feel, weave, pallu, blouse piece, washing care…"
                  />
                </Field>
              </div>
              <Field label="Tags" hint="Comma separated: bestseller, new…">
                <TextInput
                  value={draft.tagsText}
                  onChange={(e) => set("tagsText", e.target.value)}
                  placeholder="bestseller, new"
                />
              </Field>
              <Field label="Status">
                <div className="flex gap-2">
                  {statusOptions.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => set("dbStatus", s.value)}
                      title={s.hint}
                      className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${chipClass(
                        draft.dbStatus === s.value,
                      )}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          {/* ------------------------------ Photos ------------------------------ */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <h2 className="mb-1 flex items-center gap-2 text-lg text-ink">
              <ImagePlus size={17} className="text-bronze" /> Photos
            </h2>
            <p className="mb-4 text-xs leading-5 text-muted">
              Upload one saree photo (JPG, PNG or WebP, up to 8 MB). On create,
              the store picks one saree model and adds front, side, back and
              full-saree photos automatically.
            </p>
            <div className="flex flex-wrap items-start gap-3">
              {images.map((url) => (
                <div key={url} className="group relative">
                  <a href={url} target="_blank" rel="noreferrer" title="Open photo in new tab">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Product photo"
                      className="h-24 w-20 rounded-lg border border-line object-cover transition-opacity hover:opacity-85"
                    />
                  </a>
                  <button
                    type="button"
                    aria-label="Remove photo"
                    onClick={() => removePhoto(url)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-btntext shadow transition-transform hover:scale-110"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent/40 text-accent transition-colors hover:bg-accent/10">
                {busy ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Upload size={18} />
                )}
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  {busy ? "Uploading" : "Upload"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={busy || aiBusy || images.length === 0}
                onClick={runGeneration}
              >
                {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                {aiBusy
                  ? `Generating photo ${aiProgress ? Math.min(aiProgress.done + 1, aiProgress.total) : 1} of ${aiProgress?.total ?? 3}…`
                  : hasAiRenders
                    ? "Generate missing photos"
                    : "Generate model photos (front · side · back · full)"}
              </Button>
              <p className="text-xs leading-5 text-muted">
                {aiBusy
                  ? "Catalogue photoshoot running — previews appear as each photo finishes."
                  : "Finished photos are reused to avoid extra image calls. To replace a bad photo, delete it, save, then generate again."}
              </p>
            </div>
          </section>
        </div>

        {/* ------------------------------ Right: money ------------------------------ */}
        <div className="space-y-6">
          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg text-ink">Pricing</h2>
            <div className="space-y-4">
              <Field label="Selling price (₹)" required hint="Incl. of taxes">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={draft.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </Field>
              <Field label="Compare-at price (₹)" hint="Strikethrough, optional">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={draft.compareAt}
                  onChange={(e) => set("compareAt", e.target.value)}
                  placeholder="499"
                />
              </Field>
              <Field label="Unit cost (₹)" hint="Blank = auto ~50% of price">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={draft.cost}
                  onChange={(e) => set("cost", e.target.value)}
                  placeholder="Auto"
                />
              </Field>
              {margin && (
                <div className="rounded-xl bg-bg px-4 py-3 text-sm">
                  <div className="flex items-baseline justify-between">
                    <span className="font-bold text-ink">
                      {formatINR(margin.cost)}
                    </span>
                    <span
                      className={`font-display text-lg font-bold ${
                        margin.pct >= 40 ? "text-[#3f6b43]" : "text-[#b3922f]"
                      }`}
                    >
                      {margin.pct}% margin
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface2">
                    <div
                      className={`h-full rounded-full ${
                        margin.pct >= 40 ? "bg-[#4c7a4f]" : "bg-[#b3922f]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, margin.pct))}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-muted">
                    {margin.pct >= 40
                      ? "Healthy margin — covers shipping, ads and returns."
                      : "Thin margin — ₹199 pricing works best with lower unit costs."}
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="mb-4 text-lg text-ink">Inventory & visibility</h2>
            <div className="space-y-4">
              <Field label="Stock quantity">
                <TextInput
                  type="number"
                  inputMode="numeric"
                  value={draft.stock}
                  onChange={(e) => set("stock", e.target.value)}
                />
              </Field>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-bg px-4 py-3">
                <input
                  type="checkbox"
                  checked={draft.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                  className="h-4 w-4 accent-[#5d350e]"
                />
                <span className="text-sm font-semibold text-ink">
                  Featured
                  <span className="block text-[11px] font-normal text-muted">
                    Highlights on the home page
                  </span>
                </span>
              </label>
              <div className="rounded-xl border border-line bg-bg px-4 py-3">
                <p className="text-sm font-semibold text-ink">Preview</p>
                <div className="mt-2 flex items-center gap-3">
                  <AdminThumb
                    product={{
                      slug: draft.slug || "saree",
                      name: draft.name || "New Saree",
                      colorway: draft.colorway,
                      category: draft.category,
                      images,
                    }}
                    className="h-20 w-16"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {draft.name || "New Saree"}
                    </p>
                    <p className="text-xs text-muted">Category · Fabric</p>
                    <p className="text-sm font-bold text-bronze">
                      {Number(draft.price) > 0 ? formatINR(Number(draft.price)) : "—"}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  Live at /sarees/{draft.slug || "…"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/admin/products")}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || deleting} size="lg">
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
          {editing ? "Save changes" : "Create saree & AI photos"}
        </Button>
      </div>
    </form>
  );
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
