"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button, Field, TextInput } from "@/components/ui";

export function AdminLogin({
  demoHint,
  note,
}: {
  demoHint?: { email: string; password: string };
  /** Backend-specific guidance shown under the form. */
  note?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setBusy(false);
      setError(data.error ?? "Sign in failed");
      return;
    }
    router.replace("/admin");
    router.refresh();
  };

  return (
    <div className="w-full max-w-sm">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-ink2 hover:text-ink"
      >
        <ArrowLeft size={15} /> Back to store
      </Link>

      <div className="rounded-3xl border border-line bg-surface p-7 shadow-sm">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-btntext">
          <ShieldCheck size={22} />
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink">Admin Sign In</h1>
        <p className="mt-1.5 text-sm leading-6 text-ink2">
          Restricted area — store operations, products and orders.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Email" required>
            <TextInput
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@thetanti.in"
            />
          </Field>
          <Field label="Password" required>
            <TextInput
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Signing in
              </>
            ) : (
              <>
                <KeyRound size={16} /> Sign In
              </>
            )}
          </Button>
        </form>
      </div>

      {demoHint && (
        <p className="mt-4 rounded-xl border border-bronze/40 bg-bronze/10 px-4 py-3 text-center text-[13px] leading-5 text-ink2">
          <strong className="text-ink">Demo admin:</strong> {demoHint.email} ·{" "}
          {demoHint.password}
        </p>
      )}
      {note && !demoHint && (
        <p className="mt-4 rounded-xl border border-bronze/40 bg-bronze/10 px-4 py-3 text-center text-[13px] leading-5 text-ink2">
          {note}
        </p>
      )}
    </div>
  );
}
