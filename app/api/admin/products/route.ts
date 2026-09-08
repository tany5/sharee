import { NextResponse } from "next/server";
import {
  adminProducts,
  ensureStoreSeeded,
  listCategoriesAll,
  upsertProduct,
} from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  // Supabase bootstrap: seed the catalogue the first time an admin opens this.
  try {
    await ensureStoreSeeded();
  } catch {
    /* non-fatal — the store stays empty until products are added */
  }
  const [products, categories] = await Promise.all([
    adminProducts(),
    listCategoriesAll(),
  ]);
  return NextResponse.json({ ok: true, products, categories });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Product name is required" }, { status: 400 });
  }
  const category = String(body.category ?? "cotton-sarees");
  const categories = await listCategoriesAll();
  if (!categories.some((c) => c.slug === category)) {
    return NextResponse.json({ ok: false, error: "Choose a valid category" }, { status: 400 });
  }

  // Slug comes from the client; fall back to deriving it from the name so a
  // missing slug never 400s on an otherwise valid product.
  const slug = String(body.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const finalSlug = slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  if (!finalSlug || finalSlug === "saree") {
    return NextResponse.json({ ok: false, error: "Choose a valid product slug" }, { status: 400 });
  }
  const existing = await adminProducts();
  if (existing.some((p) => p.slug === finalSlug)) {
    return NextResponse.json(
      { ok: false, error: "A product with that slug already exists" },
      { status: 409 },
    );
  }

  const num = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  try {
    // NOTE: AI model photos are NOT generated here — GPU renders take minutes
    // and would blow the serverless timeout, killing the whole save. The
    // product is persisted instantly; the editor kicks off the resumable
    // generation loop right after (POST /api/admin/products/generate-photos).
    const productImages = Array.isArray(body.images)
      ? body.images.map(String).filter(Boolean)
      : [];
    const row = await upsertProduct({
      slug: finalSlug,
      name,
      category,
      description: String(body.description ?? ""),
      details: String(body.details ?? ""),
      fabric: String(body.fabric ?? ""),
      occasion: String(body.occasion ?? ""),
      colorway: String(body.colorway ?? "Maroon"),
      colors: Array.isArray(body.colors) ? body.colors.map(String) : undefined,
      price: Math.max(0, num(body.price, 199)),
      compareAt: body.compareAt ? Math.max(0, num(body.compareAt, 0)) : undefined,
      cost: Math.max(0, num(body.cost, 0)),
      stock: Math.max(0, Math.round(num(body.stock, 10))),
      rating: Math.min(5, Math.max(0, num(body.rating, 0))),
      reviewCount: Math.max(0, Math.round(num(body.reviewCount, 0))),
      tags: Array.isArray(body.tags) ? body.tags.map(String) : [],
      featured: Boolean(body.featured),
      images: productImages,
      dbStatus: body.dbStatus === "active" ? "active" : "draft",
    });
    return NextResponse.json({ ok: true, product: row });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not save the product" },
      { status: e.code === "conflict" ? 409 : 400 },
    );
  }
}
