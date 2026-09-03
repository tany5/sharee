import { NextResponse } from "next/server";
import { currentUser, ordersForUser } from "@/lib/backend";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: true, orders: [] });
  }
  const orders = await ordersForUser(user.id);
  return NextResponse.json({ ok: true, orders });
}
