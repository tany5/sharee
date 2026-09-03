import { NextResponse } from "next/server";
import { publicUsers, allOrders } from "@/lib/demo/db";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();
  const orders = allOrders().filter((o) => o.fulfilment !== "cancelled");

  const customers = publicUsers()
    .filter((u) => u.role === "customer")
    .map((u) => {
      const theirs = orders.filter((o) => o.userId === u.id);
      return {
        ...u,
        ordersCount: theirs.length,
        totalSpend: theirs.reduce((s, o) => s + o.total, 0),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return NextResponse.json({ ok: true, customers });
}
