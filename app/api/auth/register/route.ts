import { NextResponse } from "next/server";
import { registerUser } from "@/lib/backend";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: { name?: string; email?: string; phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const phone = body.phone?.trim() ?? "";
  const password = body.password ?? "";

  if (name.length < 2) {
    return NextResponse.json({ ok: false, error: "Please enter your name" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "Please enter a valid email" }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 6 characters" },
      { status: 400 },
    );
  }

  const result = await registerUser({ name, email, phone, password });
  if (!result.ok) {
    const conflict = /exists/i.test(result.error ?? "");
    return NextResponse.json(
      { ok: false, error: result.error ?? "Could not create your account" },
      { status: conflict ? 409 : 500 },
    );
  }
  if (result.needsConfirm) {
    return NextResponse.json({
      ok: true,
      needsConfirm: true,
      error:
        "Account created — check your email to confirm, then sign in.",
    });
  }
  return NextResponse.json({ ok: true, user: result.user });
}
