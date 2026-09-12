import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import { updateMetaProfiles } from "@/lib/marketing/meta-profile";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await requireAdmin())) return unauthorized();

  try {
    const result = await updateMetaProfiles();
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 400 });
  }
}
