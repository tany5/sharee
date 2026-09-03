import { NextResponse } from "next/server";
import {
  adminProducts,
  categories,
  slugify,
  upsertProduct,
  DbError,
} from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({
    ok: true,
    products: adminProducts(),
    categories: categories(),
  });
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
  if (!categories().some((c) => c.slug === category)) {
    return NextResponse.json({ ok: false, error: "Choose a valid category" }, { status: 400 });
  }

  const slug = slugify(String(body.slug ?? "") || name);
  if (adminProducts().some((p) => p.slug === slug)) {
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
    const row = await upsertProduct({
      slug,
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
      images: Array.isArray(body.images) ? body.images.map(String) : [],
      dbStatus: body.dbStatus === "active" ? "active" : "draft",
    });
    return NextResponse.json({ ok: true, product: row });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not save the product" }, { status: 500 });
  }
}
