import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { currentUser, saveAddresses } from "@/lib/backend";
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
    return NextResponse.json(
      { ok: false, error: "Please check the address", fieldErrors: check.errors },
      { status: 400 },
    );
  }

  const next: AddressBookAddress = {
    ...check.address,
    id: randomUUID(),
    label: body.label?.trim() || undefined,
    isDefault: user.addresses.length === 0,
    createdAt: new Date().toISOString(),
  };
  const saved = await saveAddresses(user.id, [...user.addresses, next]);
  if (!saved) {
    return NextResponse.json({ ok: false, error: "Could not save the address" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, user: saved });
}
