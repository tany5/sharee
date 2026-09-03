import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { ordersForUser } from "@/lib/demo/db";

export async function GET() {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: true, orders: [] });
  }
  const orders = ordersForUser(user.id);
  return NextResponse.json({ ok: true, orders });
}
