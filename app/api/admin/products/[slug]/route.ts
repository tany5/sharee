import { NextResponse } from "next/server";
import { adminProducts, deleteMediaFiles, deleteProduct, upsertProduct } from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { parseMarketing } from "@/lib/marketing/types";
import type { DbStatus } from "@/lib/types";
import type { DbProduct } from "@/lib/demo/db";

function productMediaUrls(product: DbProduct): string[] {
  const marketing = parseMarketing(product.marketing);
  return [
    ...(product.images ?? []),
    marketing.tryOn?.imageUrl,
    marketing.tryOn?.garmentUrl,
    ...(marketing.tryOn?.renders?.map((render) => render.imageUrl) ?? []),
    marketing.video?.url,
    ...(marketing.posts?.map((post) => post.url) ?? []),
  ].filter((url): url is string => typeof url === "string" && url.trim().length > 0);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAdmin())) return unauthorized();
  const { slug } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  try {
    const images = Array.isArray(body.images) ? body.images.map(String).filter(Boolean) : undefined;
    const removedImages = Array.isArray(body.removedImages)
      ? body.removedImages.map(String).filter(Boolean)
      : [];
    const removedSet = new Set(removedImages);
    const nextImageSet = new Set(images ?? []);
    const cleanupUrls = removedImages.filter((url) => !nextImageSet.has(url));
    const existingRow = cleanupUrls.length > 0
      ? (await adminProducts()).find((p) => p.slug === slug)
      : undefined;
    const marketing = existingRow ? parseMarketing(existingRow.marketing) : undefined;
    const cleanedTryOn = (() => {
      if (!marketing?.tryOn) return undefined;
      const { imageUrl, renders, ...rest } = marketing.tryOn;
      return {
        ...rest,
        ...(imageUrl && !removedSet.has(imageUrl) ? { imageUrl } : {}),
        renders: renders?.filter((render) => !removedSet.has(render.imageUrl)),
      };
    })();
    if (cleanedTryOn?.renders?.length === 0) delete cleanedTryOn.renders;
    const cleanedMarketing = marketing
      ? {
          ...marketing,
          ...(cleanedTryOn ? { tryOn: cleanedTryOn } : {}),
        }
      : undefined;
    const row = await upsertProduct({
      slug,
      name: body.name !== undefined ? String(body.name) : undefined,
      category: body.category !== undefined ? String(body.category) : undefined,
      description: body.description !== undefined ? String(body.description) : undefined,
      details: body.details !== undefined ? String(body.details) : undefined,
      fabric: body.fabric !== undefined ? String(body.fabric) : undefined,
      occasion: body.occasion !== undefined ? String(body.occasion) : undefined,
      colorway: body.colorway !== undefined ? String(body.colorway) : undefined,
      colors: Array.isArray(body.colors)
        ? body.colors.map(String)
        : body.colors !== undefined
          ? String(body.colors).split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      price: body.price !== undefined ? Math.max(0, num(body.price, 199)) : undefined,
      cost: body.cost !== undefined ? Math.max(0, num(body.cost, 0)) : undefined,
      stock: body.stock !== undefined ? Math.max(0, Math.round(num(body.stock, 10))) : undefined,
      rating: body.rating !== undefined ? Math.min(5, Math.max(0, num(body.rating, 0))) : undefined,
      reviewCount:
        body.reviewCount !== undefined
          ? Math.max(0, Math.round(num(body.reviewCount, 0)))
          : undefined,
      tags: Array.isArray(body.tags)
        ? body.tags.map(String)
        : body.tags !== undefined
          ? String(body.tags).split(",").map((s) => s.trim()).filter(Boolean)
          : undefined,
      featured: body.featured !== undefined ? Boolean(body.featured) : undefined,
      images,
      marketing: cleanedMarketing,
      dbStatus:
        body.dbStatus === "active" || body.dbStatus === "draft"
          ? (body.dbStatus as DbStatus)
          : body.dbStatus === "deleted"
            ? "deleted"
            : undefined,
    });
    await deleteMediaFiles(cleanupUrls);
    return NextResponse.json({ ok: true, product: row });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not save the product" },
      { status: e.code === "conflict" ? 409 : 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAdmin())) return unauthorized();
  const { slug } = await params;
  try {
    const product = (await adminProducts()).find((p) => p.slug === slug);
    if (!product) {
      return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
    }
    const cleanupUrls = productMediaUrls(product);
    await deleteProduct(slug);
    try {
      await deleteMediaFiles(cleanupUrls);
    } catch (cleanupErr) {
      return NextResponse.json({
        ok: true,
        cleanupError:
          cleanupErr instanceof Error
            ? cleanupErr.message
            : "Product deleted, but some media files could not be removed.",
        deletedImages: 0,
      });
    }
    return NextResponse.json({ ok: true, deletedImages: new Set(cleanupUrls).size });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not delete the product" },
      { status: e.code === "not_found" ? 404 : 500 },
    );
  }
}
