import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser } from "@/lib/auth/session";
import { updateUserAddresses, findUserById } from "@/lib/demo/db";
import { validateAddress } from "@/lib/validations";
import type { AddressBookAddress, DeliveryAddress } from "@/lib/types";

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in first" }, { status: 401 });
  }

  let body: Partial<DeliveryAddress> & { label?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const check = validateAddress(body);
  if (!check.ok || !check.address) {
    return NextResponse.json({ ok: false, error: "Please check the address", fieldErrors: check.errors }, { status: 400 });
  }

  const current = findUserById(user.id);
  if (!current) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }
  const next: AddressBookAddress = {
    ...check.address,
    id: randomUUID(),
    label: body.label?.trim() || undefined,
    isDefault: current.addresses.length === 0,
    createdAt: new Date().toISOString(),
  };
  const saved = await updateUserAddresses(user.id, [...current.addresses, next]);
  return NextResponse.json({ ok: true, user: saved });
}
