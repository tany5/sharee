"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  History,
  Loader2,
  LogOut,
  MapPin,
  PackageOpen,
  Plus,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, Field, TextArea, TextInput, SelectInput, EmptyState } from "@/components/ui";
import { INDIAN_STATES, validateAddress, type AddressErrors } from "@/lib/validations";
import { ORDERS_KEY } from "@/lib/client-store";
import { useLocalValue } from "@/lib/client-hooks";
import { formatDate, formatINR } from "@/lib/format";
import type {
  AddressBookAddress,
  DeliveryAddress,
  FulfilmentStatus,
  Order,
} from "@/lib/types";

const FULFILMENT_LABEL: Record<FulfilmentStatus, string> = {
  pending: "Pending",
  dispatched: "Dispatched",
  completed: "Completed",
  cancelled: "Cancelled",
};

function StatusChip({ status }: { status: FulfilmentStatus }) {
  const styles: Record<FulfilmentStatus, string> = {
    pending: "bg-[#b3922f]/15 text-[#7a5c14]",
    dispatched: "bg-[#2c5f8a]/15 text-[#22506f]",
    completed: "bg-[#4c7a4f]/15 text-[#3f6b43]",
    cancelled: "bg-danger/15 text-danger",
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${styles[status]}`}>
      {FULFILMENT_LABEL[status]}
    </span>
  );
}

function prettyDate(iso: string): string {
  return formatDate(iso);
}

/* ---------------------------- Guest auth card ---------------------------- */

function AuthCard() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result =
      mode === "login"
        ? await login(email.trim(), password)
        : await register({ name: name.trim(), email: email.trim(), phone: phone.trim(), password });
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Something went wrong");
  };

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <div className="text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/15 text-accent">
          <UserRound size={26} />
        </span>
        <h2 className="mt-3 font-display text-2xl text-ink">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-ink2">
          {mode === "login"
            ? "Sign in to see your orders, save addresses and check out faster."
            : "Just a name, email and password — your orders and addresses stay saved here."}
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        {mode === "register" && (
          <>
            <Field label="Full name" required>
              <TextInput
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Riya Sharma"
                autoComplete="name"
              />
            </Field>
            <Field label="Mobile number" hint="Optional">
              <TextInput
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98765 43210"
                autoComplete="tel"
              />
            </Field>
          </>
        )}
        <Field label="Email" required>
          <TextInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Password" required hint="At least 6 characters">
          <TextInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
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
              <Loader2 size={17} className="animate-spin" /> Please wait
            </>
          ) : mode === "login" ? (
            "Sign In"
          ) : (
            "Create Account"
          )}
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-ink2">
        {mode === "login" ? "New here?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "login" ? "register" : "login"));
            setError(null);
          }}
          className="font-bold text-accent underline underline-offset-4"
        >
          {mode === "login" ? "Create an account" : "Sign in instead"}
        </button>
      </p>
      <p className="mt-4 rounded-xl bg-bg/70 px-4 py-3 text-center text-xs leading-5 text-muted">
        You can still shop as a guest without an account — orders placed while
        signed in sync to this profile.
      </p>
    </div>
  );
}

/* --------------------------- Address book --------------------------- */

function AddressBook({
  addresses,
  onAdd,
  onDelete,
  onDefault,
}: {
  addresses: AddressBookAddress[];
  onAdd: (a: DeliveryAddress & { label?: string }) => Promise<{ ok: boolean; error?: string }>;
  onDelete: (id: string) => Promise<void>;
  onDefault: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<DeliveryAddress>>({});
  const [errors, setErrors] = useState<AddressErrors>({});
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof DeliveryAddress) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const check = validateAddress(form);
    if (!check.ok || !check.address) {
      setErrors(check.errors);
      return;
    }
    setBusy(true);
    const res = await onAdd({ ...check.address, label: label.trim() || undefined });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Could not save the address");
      return;
    }
    setForm({});
    setLabel("");
    setErrors({});
    setOpen(false);
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg text-ink">
          <MapPin size={18} className="text-bronze" /> Saved Addresses
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          <Plus size={15} /> {open ? "Cancel" : "Add address"}
        </Button>
      </div>

      {open && (
        <form
          onSubmit={submit}
          noValidate
          className="mt-4 rounded-2xl border border-line bg-bg/60 p-4 sm:p-5"
        >
          {error && (
            <p role="alert" className="mb-3 rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Address label" hint="Home, Work...">
              <TextInput
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home"
              />
            </Field>
            <Field label="Full name" required error={errors.fullName}>
              <TextInput value={form.fullName ?? ""} onChange={set("fullName")} />
            </Field>
            <Field label="Mobile" required error={errors.phone}>
              <TextInput
                type="tel"
                inputMode="numeric"
                value={form.phone ?? ""}
                onChange={set("phone")}
              />
            </Field>
            <Field label="Pincode" required error={errors.pincode}>
              <TextInput inputMode="numeric" value={form.pincode ?? ""} onChange={set("pincode")} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Address" required error={errors.line1}>
                <TextArea value={form.line1 ?? ""} onChange={set("line1")} />
              </Field>
            </div>
            <Field label="Landmark" hint="Optional">
              <TextInput value={form.landmark ?? ""} onChange={set("landmark")} />
            </Field>
            <Field label="City" required error={errors.city}>
              <TextInput value={form.city ?? ""} onChange={set("city")} />
            </Field>
            <Field label="State" required error={errors.state}>
              <SelectInput value={form.state ?? ""} onChange={set("state")}>
                <option value="">Select state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save address"}
            </Button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No saved addresses yet — add one to autofill checkout next time.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  {a.label && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-accent">
                      {a.label}
                    </span>
                  )}
                  <p className="mt-1.5 text-sm font-bold text-ink">{a.fullName}</p>
                  <p className="text-[13px] leading-5 text-ink2">
                    {a.line1}
                    {a.landmark ? `, ${a.landmark}` : ""}, {a.city}, {a.state} — {a.pincode}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{a.phone}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  {a.isDefault ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-[#4c7a4f]">
                      <BadgeCheck size={13} /> Default
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDefault(a.id)}
                      className="text-[11px] font-semibold text-accent underline underline-offset-2"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(a.id)}
                    aria-label={`Delete address ${a.label ?? "at " + a.city}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* ----------------------------- Orders list ----------------------------- */

function OrdersList({ orders }: { orders: Order[] | null }) {
  if (orders === null) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className="h-32 animate-pulse rounded-2xl bg-surface2" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface2" />
      </div>
    );
  }
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<PackageOpen size={28} />}
        title="No orders yet"
        body="Orders you place while signed in will appear here with live status — pending, dispatched and delivered."
      />
    );
  }
  return (
    <ul className="space-y-4">
      {orders.map((o) => (
        <li key={o.id} className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-mono text-sm font-bold text-ink">{o.number}</p>
            <StatusChip status={o.fulfilment ?? "pending"} />
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                o.paymentStatus === "paid"
                  ? "bg-[#4c7a4f]/15 text-[#3f6b43]"
                  : o.paymentStatus === "cod"
                    ? "bg-[#4c7a4f]/15 text-[#3f6b43]"
                    : "bg-danger/15 text-danger"
              }`}
            >
              {o.paymentStatus === "paid"
                ? "Paid"
                : o.paymentStatus === "cod"
                  ? "Cash on Delivery"
                  : o.paymentStatus}
            </span>
            <span className="ml-auto text-xs text-muted">
              {prettyDate(o.createdAt)} · Est. delivery {prettyDate(o.estimatedDelivery)}
            </span>
          </div>

          <div className="mt-3 divide-y divide-line border-t border-line">
            {o.items.map((it, i) => (
              <div key={`${it.slug}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 truncate text-ink">
                  {it.name}
                  <span className="text-muted"> × {it.qty}</span>
                </span>
                <span className="shrink-0 font-semibold text-ink">
                  {formatINR(it.price * it.qty)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-xs text-muted">
              Delivering to {o.address.city}, {o.address.state} {o.address.pincode}
            </span>
            <span className="font-display text-lg font-bold text-ink">
              {formatINR(o.total)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Main view ------------------------------ */

export function AccountView() {
  const { user, loading, logout, refresh } = useAuth();
  const [serverOrders, setServerOrders] = useState<Order[] | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deviceOrders = useLocalValue<Order[]>(ORDERS_KEY, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/account/orders", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ orders: Order[] }>)
      .then((d) => {
        if (active) setServerOrders(d.orders);
      })
      .catch(() => {
        if (active) setServerOrders([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const addAddress = async (a: DeliveryAddress & { label?: string }) => {
    setAddError(null);
    try {
      const res = await fetch("/api/account/addresses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(a),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setAddError(data.error ?? "Could not save the address");
        return { ok: false, error: data.error };
      }
      await refresh();
      return { ok: true };
    } catch {
      return { ok: false, error: "Network error" };
    }
  };

  const deleteAddress = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/account/addresses/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setDeleting(false);
    }
  };

  const setDefaultAddress = async (id: string) => {
    await fetch(`/api/account/addresses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    await refresh();
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10 text-center" aria-hidden>
        <div className="mx-auto h-14 w-14 animate-pulse rounded-full bg-surface2" />
        <div className="mx-auto h-6 w-48 animate-pulse rounded-full bg-surface2" />
        <div className="mx-auto h-64 max-w-md animate-pulse rounded-3xl bg-surface2" />
      </div>
    );
  }

  /* ----------------------------- Signed out ----------------------------- */
  if (!user) {
    return (
      <div className="space-y-10">
        <AuthCard />

        {deviceOrders.length > 0 && (
          <section className="mx-auto max-w-3xl">
            <h2 className="mb-3 flex items-center gap-2 text-lg text-ink">
              <History size={18} className="text-bronze" /> Orders from this device
            </h2>
            <div className="space-y-3">
              {deviceOrders.map((o) => (
                <div key={o.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
                  <p className="font-mono font-bold text-ink">{o.number}</p>
                  <p className="mt-1 text-xs text-muted">
                    {o.items.length} item(s) · {formatINR(o.total)} ·{" "}
                    {prettyDate(o.createdAt)} · Delivering to {o.address.city}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              These orders live only in this browser. Sign in above to keep your
              history on this profile instead.
            </p>
          </section>
        )}
      </div>
    );
  }

  /* ------------------------------ Signed in ------------------------------ */
  const initial = (user.name || "A").slice(0, 1).toUpperCase();

  return (
    <div className="space-y-10">
      {/* Profile */}
      <section className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ink font-display text-2xl font-bold text-btntext">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl text-ink">{user.name}</h1>
            {user.role === "admin" && (
              <span className="flex items-center gap-1 rounded-full bg-bronze/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-bronze">
                <ShieldCheck size={12} /> Admin
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-ink2">
            {user.email}
            {user.phone ? ` · ${user.phone}` : ""} · Member since {prettyDate(user.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-bronze/60 px-5 text-[15px] font-semibold text-bronze transition-colors hover:bg-bronze/15"
            >
              <Settings2 size={16} /> Open Admin
            </Link>
          )}
          <Button variant="outline" onClick={logout}>
            <LogOut size={16} /> Sign out
          </Button>
        </div>
      </section>

      {/* Addresses */}
      <AddressBook
        addresses={user.addresses}
        onAdd={addAddress}
        onDelete={deleteAddress}
        onDefault={setDefaultAddress}
      />
      {addError && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
          {addError}
        </p>
      )}

      {/* Order history */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg text-ink">
          <History size={18} className="text-bronze" /> Order History
        </h2>
        <OrdersList orders={serverOrders} />
      </section>
    </div>
  );
}
