import { NextResponse } from "next/server";
import {
  createCategory,
  listCategoriesAll,
  removeCategory,
  updateCategory,
} from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { revalidateCatalogue } from "@/lib/data/catalogue-cache";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ ok: true, categories: await listCategoriesAll() });
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
    revalidateCatalogue();
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not save the category" },
      { status: e.code === "conflict" ? 409 : 500 },
    );
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
    revalidateCatalogue();
    return NextResponse.json({ ok: true, category });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not update the category" },
      { status: e.code === "not_found" ? 404 : 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await requireAdmin())) return unauthorized();
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });
  try {
    await removeCategory(slug);
    revalidateCatalogue();
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; message?: string };
    return NextResponse.json(
      { ok: false, error: e.message ?? "Could not delete the category" },
      { status: e.code === "in_use" ? 409 : e.code === "not_found" ? 404 : 500 },
    );
  }
}
