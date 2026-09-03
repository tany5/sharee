import { NextResponse } from "next/server";
import { loginUser } from "@/lib/backend";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  const result = await loginUser(email, password);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error ?? "Sign in failed" },
      { status: 401 },
    );
  }
  return NextResponse.json({ ok: true, user: result.user });
}
