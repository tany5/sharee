import { NextResponse } from "next/server";
import { allOrders } from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  return NextResponse.json({ ok: true, orders: allOrders() });
}
