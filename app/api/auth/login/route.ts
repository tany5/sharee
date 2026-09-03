import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/demo/db";
import { verifyPassword } from "@/lib/auth/password";
import { startSession } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/types";

function toPublic(user: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: "customer" | "admin";
  addresses: PublicUser["addresses"];
  createdAt: string;
}): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    addresses: user.addresses,
    createdAt: user.createdAt,
  };
}

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  const stored = findUserByEmail(email);
  if (!stored || !verifyPassword(password, stored.passwordSalt, stored.passwordHash)) {
    return NextResponse.json(
      { ok: false, error: "Incorrect email or password" },
      { status: 401 },
    );
  }

  await startSession(stored.id);
  return NextResponse.json({ ok: true, user: toPublic(stored) });
}
