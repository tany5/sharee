import { NextResponse } from "next/server";
import { customersWithStats } from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const customers = await customersWithStats();
  return NextResponse.json({ ok: true, customers });
}
