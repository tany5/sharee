import { NextResponse } from "next/server";
import { allOrders, customersWithStats } from "@/lib/backend";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";

export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const [orders, customers] = await Promise.all([allOrders(), customersWithStats()]);
  // Revenue only counts confirmed sales — unpaid (pending-payment) orders are
  // excluded until Razorpay confirms them.
  const sales = orders.filter(
    (o) => o.fulfilment !== "cancelled" && o.paymentStatus !== "pending",
  );

  const itemQty = (o: (typeof sales)[number]) => o.items.reduce((s, i) => s + i.qty, 0);
  const subtotalOf = (o: (typeof sales)[number]) =>
    o.items.reduce((s, i) => s + i.price * i.qty, 0);
  const cogsOf = (o: (typeof sales)[number]) =>
    o.items.reduce((s, i) => s + (i.cost ?? 0) * i.qty, 0);

  const revenue = sales.reduce((s, o) => s + o.total, 0);
  const subtotalRevenue = sales.reduce((s, o) => s + subtotalOf(o), 0);
  const shippingCollected = sales.reduce((s, o) => s + o.shipping, 0);
  const cogs = sales.reduce((s, o) => s + cogsOf(o), 0);
  const itemsSold = sales.reduce((s, o) => s + itemQty(o), 0);
  const grossProfit = subtotalRevenue - cogs;
  const marginPct =
    subtotalRevenue > 0 ? Math.round((grossProfit / subtotalRevenue) * 1000) / 10 : 0;

  // Top sellers by units.
  const bySlug = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of sales) {
    for (const it of o.items) {
      const cur = bySlug.get(it.slug) ?? { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += it.price * it.qty;
      bySlug.set(it.slug, cur);
    }
  }
  const topProducts = [...bySlug.values()].sort((a, b) => b.qty - a.qty).slice(0, 6);

  const fulfilmentCounts = {
    pending: orders.filter((o) => o.fulfilment === "pending").length,
    dispatched: orders.filter((o) => o.fulfilment === "dispatched").length,
    completed: orders.filter((o) => o.fulfilment === "completed").length,
    cancelled: orders.filter((o) => o.fulfilment === "cancelled").length,
  };

  return NextResponse.json({
    ok: true,
    summary: {
      ordersCount: orders.length,
      revenue: Math.round(revenue),
      subtotalRevenue: Math.round(subtotalRevenue),
      shippingCollected: Math.round(shippingCollected),
      cogs: Math.round(cogs),
      grossProfit: Math.round(grossProfit),
      marginPct,
      itemsSold,
      customersCount: customers.length,
      fulfilmentCounts,
      topProducts,
      recentOrders: sales.slice(0, 5).map((o) => ({
        id: o.id,
        number: o.number,
        customer: o.userEmail ?? o.address.fullName,
        total: o.total,
        fulfilment: o.fulfilment,
        createdAt: o.createdAt,
      })),
    },
  });
}
