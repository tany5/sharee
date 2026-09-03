"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { PRODUCT_INDEX } from "@/lib/data/catalog";
import { summarizeCart } from "@/lib/cart";
import { SITE, PAYMENT_METHODS, isDemoMode, type PaymentMethodId } from "@/lib/site";
import { INDIAN_STATES, validateAddress, type AddressErrors } from "@/lib/validations";
import { saveOrder } from "@/lib/client-store";
import { readUtmFromUrl } from "@/lib/utm";
import { useCart } from "@/components/store/providers";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, EmptyState, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import SareeArt from "@/components/product/saree-art";
import { artForProduct } from "@/lib/art";
import { trackAddPaymentInfo, trackInitiateCheckout } from "@/lib/analytics";
import { formatINR } from "@/lib/format";
import { swatchFor } from "@/lib/color-dots";
import type { DeliveryAddress } from "@/lib/types";

const METHOD_ICONS: Record<PaymentMethodId, typeof Smartphone> = {
  upi: Smartphone,
  card: CreditCard,
  netbanking: Landmark,
  cod: Banknote,
};

type FormState = Partial<DeliveryAddress>;

const EMPTY: FormState = {
  fullName: "",
  phone: "",
  pincode: "",
  line1: "",
  landmark: "",
  city: "",
  state: "",
};

export function CheckoutView() {
  const router = useRouter();
  const { items, clear } = useCart();
  const { user } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [method, setMethod] = useState<PaymentMethodId>("upi");
  const [apiError, setApiError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const firedMethods = useRef<Set<PaymentMethodId>>(new Set());
  const initiateFired = useRef(false);
  const prefilledFor = useRef<string | null>(null);

  // Signed-in customers get their default address prefilled once.
  useEffect(() => {
    const def = user?.addresses.find((a) => a.isDefault) ?? user?.addresses[0];
    if (!def || prefilledFor.current === user?.id) return;
    prefilledFor.current = user?.id ?? null;
    setForm({
      fullName: def.fullName,
      phone: def.phone,
      pincode: def.pincode,
      line1: def.line1,
      landmark: def.landmark ?? "",
      city: def.city,
      state: def.state,
    });
    setErrors({});
  }, [user]);

  function prettySlug(slug: string): string {
    return slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
  }

  const visibleItems = items.filter(
    (i) => PRODUCT_INDEX[i.slug] || i.name,
  );
  const summary = useMemo(
    () => summarizeCart(visibleItems, (l) => l.price ?? SITE.price),
    [visibleItems],
  );

  // InitiateCheckout: customer reached checkout with a basket.
  useEffect(() => {
    if (visibleItems.length > 0 && !initiateFired.current) {
      initiateFired.current = true;
      trackInitiateCheckout(
        visibleItems.map((i) => i.slug),
        summary.subtotal,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const chooseMethod = (m: PaymentMethodId) => {
    setMethod(m);
    if (!firedMethods.current.has(m)) {
      firedMethods.current.add(m);
      trackAddPaymentInfo(m);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    const check = validateAddress(form);
    if (!check.ok || !check.address) {
      setErrors(check.errors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (visibleItems.length === 0) {
      setApiError("Your cart is empty.");
      return;
    }
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: visibleItems,
          address: check.address,
          paymentMethod: method,
          utm: readUtmFromUrl(),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order?: import("@/lib/types").Order;
        error?: string;
        fieldErrors?: AddressErrors;
      };
      if (!res.ok || !data.ok || !data.order) {
        setApiError(data.error ?? "Could not place your order — please try again.");
        if (data.fieldErrors) setErrors((prev) => ({ ...prev, ...data.fieldErrors }));
        return;
      }
      saveOrder(data.order);
      clear();
      router.replace(`/order-success?order=${encodeURIComponent(data.order.id)}`);
    } catch {
      setApiError("Network error — please check your connection and try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (visibleItems.length === 0) {
    return (
      <EmptyState
        icon={<Lock size={28} />}
        title="Nothing to check out yet"
        body="Add a saree (or three) to your cart first — they're all just ₹199."
        action={
          <Button variant="primary" size="lg" onClick={() => router.push("/sarees")}>
            Shop All Sarees
          </Button>
        }
      />
    );
  }

  return (
    <form id="checkout-form" onSubmit={submit} noValidate>
      {isDemoMode() && (
        <p className="mb-6 rounded-xl border border-bronze/40 bg-bronze/10 px-4 py-3 text-[13px] leading-5 text-ink2">
          <strong className="text-ink">Demo checkout:</strong> no real payment is
          processed — UPI / cards / net banking orders are simulated and marked
          paid so you can test the full funnel. Enable Razorpay via the env keys
          in <code className="rounded bg-surface px-1">.env.example</code> when
          going live.
        </p>
      )}

      {apiError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
        >
          <TriangleAlert size={18} className="mt-0.5 shrink-0" />
          {apiError}
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_390px]">
        <div className="space-y-8">
          {/* 1 — Delivery details */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <h2 className="flex items-center gap-3 text-lg text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-btntext">
                1
              </span>
              Delivery Details
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" required error={errors.fullName}>
                <TextInput
                  autoComplete="name"
                  placeholder="Riya Sharma"
                  value={form.fullName ?? ""}
                  onChange={set("fullName")}
                  aria-invalid={Boolean(errors.fullName)}
                />
              </Field>
              <Field
                label="Mobile Number"
                required
                error={errors.phone}
                hint="For delivery updates"
              >
                <TextInput
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="98765 43210"
                  value={form.phone ?? ""}
                  onChange={set("phone")}
                  aria-invalid={Boolean(errors.phone)}
                />
              </Field>
              <Field label="Pincode" required error={errors.pincode}>
                <TextInput
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="700001"
                  maxLength={6}
                  value={form.pincode ?? ""}
                  onChange={set("pincode")}
                  aria-invalid={Boolean(errors.pincode)}
                />
              </Field>
              <Field
                label="Landmark"
                hint="Optional"
              >
                <TextInput
                  placeholder="Near Metro Station"
                  value={form.landmark ?? ""}
                  onChange={set("landmark")}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Address (House no, Street, Area)" required error={errors.line1}>
                  <TextArea
                    autoComplete="street-address"
                    placeholder="123, MG Road, Park Street Area"
                    value={form.line1 ?? ""}
                    onChange={set("line1")}
                    aria-invalid={Boolean(errors.line1)}
                  />
                </Field>
              </div>
              <Field label="City" required error={errors.city}>
                <TextInput
                  autoComplete="address-level2"
                  placeholder="Kolkata"
                  value={form.city ?? ""}
                  onChange={set("city")}
                  aria-invalid={Boolean(errors.city)}
                />
              </Field>
              <Field label="State" required error={errors.state}>
                <SelectInput
                  value={form.state ?? ""}
                  onChange={set("state")}
                  aria-invalid={Boolean(errors.state)}
                >
                  <option value="">Select state</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>
          </section>

          {/* 2 — Payment method */}
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-7">
            <h2 className="flex items-center gap-3 text-lg text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-btntext">
                2
              </span>
              Payment Method
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Payment method">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m.id];
                const active = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => chooseMethod(m.id)}
                    className={`rounded-xl border p-4 text-left transition-all ${
                      active
                        ? "border-accent bg-accent/5 ring-1 ring-accent/40"
                        : "border-line hover:border-accent/50"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon size={20} className={active ? "text-accent" : "text-muted"} />
                      <span className="text-[15px] font-semibold text-ink">{m.label}</span>
                      <span
                        aria-hidden
                        className={`ml-auto h-4 w-4 rounded-full border ${
                          active ? "border-accent bg-accent" : "border-line"
                        }`}
                        style={
                          active
                            ? { boxShadow: "inset 0 0 0 4px var(--surface)" }
                            : undefined
                        }
                      />
                    </span>
                    <span className="mt-1.5 block pl-8 text-xs leading-5 text-muted">
                      {m.blurb}
                    </span>
                  </button>
                );
              })}
            </div>
            {method === "cod" && (
              <div className="mt-4 rounded-xl border border-[#4c7a4f]/30 bg-[#4c7a4f]/10 px-4 py-3 text-[13px] leading-6 text-ink2">
                <p className="font-bold text-ink">Cash on Delivery</p>
                Pay in cash when your order is delivered to your doorstep.
              </div>
            )}
            {method !== "cod" && isDemoMode() && (
              <p className="mt-4 rounded-xl bg-accent/10 px-4 py-3 text-[13px] leading-5 text-ink2">
                <strong className="text-ink">Demo:</strong> this payment will be
                simulated and your order marked paid instantly. No money moves.
              </p>
            )}
          </section>
        </div>

        {/* 3 — Order summary */}
        <aside className="rounded-2xl border border-line bg-surface p-5 sm:p-6 lg:sticky lg:top-40">
          <h2 className="text-xs font-bold uppercase tracking-[0.22em] text-ink">
            Order Summary · {visibleItems.length} item{visibleItems.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {visibleItems.map((line) => {
              const meta = PRODUCT_INDEX[line.slug];
              const name = line.name ?? meta?.name ?? prettySlug(line.slug);
              const linePrice = line.price ?? SITE.price;
              return (
                <li key={`${line.slug}::${line.color}`} className="flex items-center gap-3 py-3">
                  <div className="h-14 w-12 shrink-0 overflow-hidden rounded-lg ring-1 ring-line">
                    <SareeArt
                      spec={artForProduct(
                        line.slug,
                        meta?.colorway ?? line.color,
                        meta?.category ?? "",
                      )}
                      crop="portrait"
                      className="h-full w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink">
                      {name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full border border-line"
                        style={{ backgroundColor: swatchFor(line.color) }}
                      />
                      {line.color} · Qty {line.qty}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-ink">
                    {formatINR(line.qty * linePrice)}
                  </p>
                </li>
              );
            })}
          </ul>

          <dl className="mt-4 space-y-2.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between text-ink2">
              <dt>Subtotal</dt>
              <dd className="font-semibold text-ink">{formatINR(summary.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-ink2">
              <dt>Shipping</dt>
              <dd className="font-semibold text-ink">
                {summary.shipping === 0 ? (
                  <span className="text-[#4c7a4f]">Free</span>
                ) : (
                  formatINR(summary.shipping)
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-3">
              <dt className="font-bold text-ink">Total</dt>
              <dd className="font-display text-3xl font-bold text-ink">
                {formatINR(summary.total)}
              </dd>
            </div>
          </dl>

          <Button
            type="submit"
            size="lg"
            className="mt-5 hidden w-full lg:inline-flex"
            disabled={placing}
          >
            {placing ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Placing order…
              </>
            ) : (
              `Place Order · ${formatINR(summary.total)}`
            )}
          </Button>
          <p className="mt-3 hidden items-center justify-center gap-1.5 text-center text-[11px] text-muted lg:flex">
            <Lock size={12} /> Secure checkout · Guest order — no signup needed
          </p>
          <p className="mt-1 text-center text-[11px] text-muted lg:hidden">
            Review order above — price shown in the bar below.
          </p>
        </aside>
      </div>

      {/* Mobile sticky place-order bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Total</p>
            <p className="font-display text-2xl font-bold leading-none text-ink">
              {formatINR(summary.total)}
            </p>
          </div>
          <Button
            type="submit"
            form="checkout-form"
            className="ml-auto flex-1"
            size="lg"
            disabled={placing}
          >
            {placing ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Placing…
              </>
            ) : (
              "Place Order"
            )}
          </Button>
        </div>
      </div>
      <div className="h-24 lg:hidden" aria-hidden />
    </form>
  );
}
