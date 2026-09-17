"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  RefreshCcw,
  Save,
  Sparkles,
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
import type { ImageProviderStatus } from "@/lib/ai/types";
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

/** Reads a File as a data URL (provider payloads are JSON, not multipart). */
function fileToDataUrl(file?: File): Promise<string> {
  if (!file) return Promise.resolve("");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the uploaded image"));
    reader.readAsDataURL(file);
  });
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
  const [aiEngine, setAiEngine] = useState<"qwen" | "cloudflare" | null>(null);
  const [aiProvider, setAiProvider] = useState<ImageProviderStatus | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testResult, setTestResult] = useState<{
    imageUrl: string;
    provider: string;
    model: string;
    durationMs?: number;
  } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const aiPhotoUrlsRef = useRef<string[]>([]);
  const pendingUploadsRef = useRef<PendingUpload[]>([]);
  const autoStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const aiPhotoTotal = 4;

  /** Lightbox: arrow keys / Esc, with the image list pinned while open. */
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft") setLightbox((i) => (i === null ? i : (i - 1 + images.length) % images.length));
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? i : (i + 1) % images.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox === null, images.length]);

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

  /** Active image-generation provider (env-switched; refresh after restart). */
  useEffect(() => {
    let active = true;
    fetch("/api/ai/generate-product-image", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ ok: boolean; status?: ImageProviderStatus }>) : null))
      .then((d) => {
        if (active && d?.status) setAiProvider(d.status);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

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
   * `engine` picks the photoshoot engine for THIS run: qwen or cloudflare.
   */
  const runGeneration = async (engine?: "qwen" | "cloudflare", forceAll = false) => {
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
    setAiEngine(engine ?? null);
    if (forceAll) {
      aiPhotoUrlsRef.current = [];
      setHasAiRenders(false);
    }
    let landed = 0;
    try {
      for (let round = 0; round < aiPhotoTotal; round++) {
        const res = await fetch("/api/admin/products/generate-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            garmentUrl: source,
            name: draft.name.trim() || "Saree",
            slug: slugify(draft.slug || draft.name || "saree"),
            force: forceAll && round === 0,
            engine,
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
            const keep = forceAll && round === 0 ? [] : prev.filter((url) => !generated.includes(url));
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
      setAiEngine(null);
    }
  };

  /**
   * Provider test: one-off generation through the active provider (Cloudflare
   * Worker or Puter relay) without touching the product. The result stays a
   * local preview until the admin presses "Use this image", which simply adds
   * it to the product's photo list — the product keeps its current status.
   */
  const runProviderTest = async () => {
    const source = garmentSource;
    if (!source) {
      const msg = "Upload a saree photo first";
      setTestError(msg);
      toast.error(msg);
      return;
    }
    setTestBusy(true);
    setTestError(null);
    setTestResult(null);
    try {
      const sareeImage = source.startsWith("blob:")
        ? await fileToDataUrl(pendingUploads.find((p) => p.previewUrl === source)?.file)
        : source; // stored URL — the server fetches it
      const res = await fetch("/api/ai/generate-product-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sareeImage,
          prompt: undefined,
          aspectRatio: "3:4",
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        result?: { imageUrl?: string; provider?: string; model?: string; durationMs?: number; error?: string };
        error?: string;
      };
      const result = data.result;
      if (!data.ok || !result?.imageUrl) {
        throw new Error(result?.error ?? data.error ?? "Image generation failed");
      }
      setTestResult({
        imageUrl: result.imageUrl,
        provider: result.provider ?? aiProvider?.provider ?? "",
        model: result.model ?? "",
        durationMs: result.durationMs,
      });
      toast.success(`${result.provider ?? "AI"} image ready — preview below.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Image generation failed";
      setTestError(message);
      toast.error(message);
    } finally {
      setTestBusy(false);
    }
  };

  /** Adds the approved test image to the product photos (still a draft). */
  const useTestImage = () => {
    if (!testResult) return;
    setImages((prev) => [testResult.imageUrl, ...prev].slice(0, 8));
    toast.info("Image added to the product photos — press Save to keep it. The product status did not change.");
    setTestResult(null);
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
      // Deferred so the effect body itself stays setState-free. Defaults to
      // the TRYON_PROVIDER engine (no engine param = server default).
      const t = setTimeout(() => void runGeneration(undefined), 0);
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
    if (!window.confirm(`Permanently delete "${draft.name || slug}" and remove its photos from storage?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${slug}`, { method: "DELETE" });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        cleanupError?: string;
        deletedImages?: number;
      };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not delete the product");
      if (data.cleanupError) {
        toast.info(`"${draft.name || slug}" deleted. Media cleanup needs checking: ${data.cleanupError}`, {
          duration: 9000,
        });
      } else {
        toast.success(
          `"${draft.name || slug}" deleted${data.deletedImages ? ` with ${data.deletedImages} media file${data.deletedImages === 1 ? "" : "s"}` : ""}.`,
        );
      }
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
              {images.map((url, idx) => (
                <div key={url} className="group relative">
                  <button
                    type="button"
                    title="View photo"
                    onClick={() => setLightbox(idx)}
                    className="cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt={`Product photo ${idx + 1}`}
                      className="h-24 w-20 rounded-lg border border-line object-cover transition-opacity hover:opacity-85"
                    />
                  </button>
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
                onClick={() => runGeneration("qwen")}
              >
                {aiBusy && aiEngine === "qwen" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ImagePlus size={16} />
                )}
                {aiBusy && aiEngine === "qwen"
                  ? `Qwen: photo ${aiProgress ? Math.min(aiProgress.done + 1, aiProgress.total) : 1} of ${aiProgress?.total ?? 4}…`
                  : "Use Qwen (front · side · back · full)"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busy || aiBusy || images.length === 0}
                onClick={() => runGeneration("cloudflare")}
              >
                {aiBusy && aiEngine === "cloudflare" ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {aiBusy && aiEngine === "cloudflare"
                  ? `Cloudflare: photo ${aiProgress ? Math.min(aiProgress.done + 1, aiProgress.total) : 1} of ${aiProgress?.total ?? 4}…`
                  : "Use Cloudflare (front · side · back · full)"}
              </Button>
              {hasAiRenders ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy || aiBusy || images.length === 0}
                  onClick={() => runGeneration(aiEngine ?? "qwen", true)}
                >
                  {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
                  Regenerate all photos
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              {aiBusy
                ? `${aiEngine === "cloudflare" ? "Cloudflare" : "Qwen"} photoshoot running — previews appear as each photo finishes.`
                : "Qwen = DashScope image-edit (needs QWEN_API_KEY). Cloudflare = Workers AI FLUX.2 klein (needs the image worker running). Both keep the same model across poses and vary the background per photo."}
            </p>

            {/* --------------------- Provider test panel --------------------- */}
            <div className="mt-5 rounded-xl border border-line bg-bg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={15} className="text-bronze" />
                  <p className="text-sm font-bold text-ink">Test AI Image</p>
                  {aiProvider && (
                    <span className="rounded-pill border border-line bg-surface px-2.5 py-0.5 text-[11px] font-semibold text-ink2">
                      Image Provider: {aiProvider.provider === "cloudflare" ? "Cloudflare" : "Puter"}
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testBusy || images.length === 0}
                  onClick={() => void runProviderTest()}
                >
                  {testBusy ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {testBusy
                    ? "Generating…"
                    : aiProvider?.provider === "cloudflare"
                      ? "Generate with Cloudflare"
                      : "Test AI Image"}
                </Button>
              </div>

              {/* Debug block — dev only by default (IMAGE_GENERATION_DEBUG). */}
              {aiProvider?.debug && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] leading-4 text-muted sm:grid-cols-3">
                  <div>
                    <dt className="inline">Provider: </dt>
                    <dd className="inline font-semibold text-ink2">{aiProvider.provider}</dd>
                  </div>
                  <div className="min-w-0 truncate">
                    <dt className="inline">Model: </dt>
                    <dd className="inline font-semibold text-ink2">{aiProvider.model}</dd>
                  </div>
                  {aiProvider.workerUrl && (
                    <div className="min-w-0 truncate">
                      <dt className="inline">Worker: </dt>
                      <dd className="inline font-semibold text-ink2">{aiProvider.workerUrl}</dd>
                    </div>
                  )}
                  <div>
                    <dt className="inline">Status: </dt>
                    <dd className="inline font-semibold text-ink2">
                      {testBusy ? "Generating…" : testResult ? "Success" : testError ? "Failed" : "Idle"}
                    </dd>
                  </div>
                  {aiProvider.provider === "puter" && (
                    <div>
                      <dt className="inline">Relay: </dt>
                      <dd className="inline font-semibold text-ink2">
                        {aiProvider.puterRelayConnected ? "connected" : "not connected"}
                      </dd>
                    </div>
                  )}
                </dl>
              )}

              {testError && (
                <p role="alert" className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                  {testError}
                </p>
              )}

              {testBusy && (
                <p className="mt-3 text-xs text-muted">
                  Creating your saree campaign… the first request after a cold start can take a while.
                </p>
              )}

              {testResult && (
                <div className="mt-3 flex flex-wrap items-start gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={testResult.imageUrl}
                    alt="Generated preview"
                    className="h-48 w-36 rounded-lg border border-line object-cover"
                  />
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-xs text-muted">
                      {testResult.provider} · {testResult.model}
                      {testResult.durationMs ? ` · ${(testResult.durationMs / 1000).toFixed(1)}s` : ""}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={useTestImage}>
                        <Check size={14} /> Use this image
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setTestResult(null)}
                      >
                        Discard
                      </Button>
                    </div>
                    <p className="max-w-xs text-[11px] leading-4 text-muted">
                        The preview is not saved anywhere until you press Use this image + Save.
                    </p>
                  </div>
                </div>
              )}
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

      {lightbox !== null && images[lightbox] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Product photo viewer"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          {/* Prev / Next — infinite loop */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) => (i === null ? i : (i - 1 + images.length) % images.length));
                }}
                className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightbox((i) => (i === null ? i : (i + 1) % images.length));
                }}
                className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Close viewer"
            onClick={() => setLightbox(null)}
            className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-accent"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[lightbox]}
            alt={`Product photo ${lightbox + 1} of ${images.length}`}
            className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-white">
            {lightbox + 1} / {images.length}
          </div>
        </div>
      )}
    </form>
  );
}

function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
