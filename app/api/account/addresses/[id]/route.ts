import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { updateUserAddresses, findUserById } from "@/lib/demo/db";
import type { AddressBookAddress, DeliveryAddress } from "@/lib/types";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in first" }, { status: 401 });
  }
  const { id } = await params;

  let body: Partial<DeliveryAddress> & { label?: string; isDefault?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const stored = findUserById(user.id);
  if (!stored) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  const target = stored.addresses.find((a) => a.id === id);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Address not found" }, { status: 404 });
  }

  const addresses = stored.addresses.map((a) => {
    if (a.id !== id) return { ...a, isDefault: false };
    return {
      ...a,
      ...body,
      isDefault: body.isDefault ?? a.isDefault,
    } as AddressBookAddress;
  });

  const saved = await updateUserAddresses(user.id, addresses);
  return NextResponse.json({ ok: true, user: saved });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Please sign in first" }, { status: 401 });
  }
  const { id } = await params;
  const stored = findUserById(user.id);
  if (!stored) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }

  let addresses = stored.addresses.filter((a) => a.id !== id);
  // If the default was removed, promote the first remaining address.
  if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
    addresses = addresses.map((a, i) => ({ ...a, isDefault: i === 0 }));
  }
  const saved = await updateUserAddresses(user.id, addresses);
  return NextResponse.json({ ok: true, user: saved });
}
