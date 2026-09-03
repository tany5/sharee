import { NextResponse } from "next/server";
import { upsertProduct, deleteProduct, DbError } from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import type { DbStatus } from "@/lib/demo/db";

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
      images: Array.isArray(body.images) ? body.images.map(String) : undefined,
      dbStatus: (body.dbStatus as DbStatus) === "active" || (body.dbStatus as DbStatus) === "draft"
        ? (body.dbStatus as DbStatus)
        : undefined,
    });
    return NextResponse.json({ ok: true, product: row });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 400 });
    }
    return NextResponse.json({ ok: false, error: "Could not save the product" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!(await requireAdmin())) return unauthorized();
  const { slug } = await params;
  try {
    await deleteProduct(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Could not delete the product" }, { status: 500 });
  }
}
