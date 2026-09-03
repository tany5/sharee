import "server-only";
import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import type { PublicUser } from "@/lib/types";

/** Resolves the current user only when they are an admin (else null). */
export async function requireAdmin(): Promise<PublicUser | null> {
  const user = await currentUser();
  return user?.role === "admin" ? user : null;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "Not authorised" }, { status: 401 });
}
