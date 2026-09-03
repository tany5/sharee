import { NextResponse } from "next/server";
import {
  categories,
  createCategory,
  updateCategory,
  removeCategory,
  DbError,
} from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ ok: true, categories: categories() });
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  let body: { name?: string; short?: string; blurb?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ ok: false, error: "Category name is required" }, { status: 400 });
  }
  try {
    const category = await createCategory({
      name: body.name,
      short: body.short ?? "",
      blurb: body.blurb ?? "",
    });
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: "Could not save the category" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  let body: { name?: string; short?: string; blurb?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  try {
    const category = await updateCategory(slug, body);
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    return NextResponse.json({ ok: false, error: "Could not update the category" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  try {
    await removeCategory(slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof DbError) {
      return NextResponse.json(
        { ok: false, error: err.message },
        { status: err.code === "in_use" ? 409 : 404 },
      );
    }
    return NextResponse.json({ ok: false, error: "Could not delete the category" }, { status: 500 });
  }
}
