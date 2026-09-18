"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CreditCard,
  Landmark,
  Info,
  Loader2,
  Lock,
  MapPin,
  Smartphone,
  TriangleAlert,
} from "lucide-react";
import { PRODUCT_INDEX } from "@/lib/data/catalog";
import { summarizeCart } from "@/lib/cart";
import { SITE, PAYMENT_METHODS, isDemoMode, type PaymentMethodId } from "@/lib/site";
import { INDIAN_STATES, validateAddress, type AddressErrors } from "@/lib/validations";
import { saveOrder } from "@/lib/client-store";
import { readUtmFromUrl } from "@/lib/utm";
import {
  activeClientGateway,
  razorpayClientLive,
  type CashfreePayload,
  type RazorpayPayload,
  type RazorpaySuccessResponse,
} from "@/lib/payments/client";
import { useCart } from "@/components/store/providers";
import { useAuth } from "@/components/auth/auth-provider";
import { Button, EmptyState, Field, SelectInput, TextArea, TextInput } from "@/components/ui";
import { WornThumb } from "@/components/product/worn-image";
import { trackAddPaymentInfo, trackInitiateCheckout } from "@/lib/analytics";
import { formatINR } from "@/lib/format";
import { swatchFor } from "@/lib/color-dots";
import type { AddressBookAddress, DeliveryAddress } from "@/lib/types";

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
  /** Guest email for order updates — pre-filled for signed-in users. */
  const [email, setEmail] = useState("");
  /** WhatsApp for order/shipping updates — blank = same as mobile. */
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappSame, setWhatsappSame] = useState(true);
  const [errors, setErrors] = useState<AddressErrors>({});
  const [method, setMethod] = useState<PaymentMethodId>("upi");
  const [selectedAddressId, setSelectedAddressId] = useState<string>("manual");
  const [apiError, setApiError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  // Restored from session storage when the customer arrives via
  // "Retry Payment" (failure page) — the pending gateway payload for the
  // exact order is re-offered as "Resume Payment" instead of a duplicate.
  const [pendingPay, setPendingPay] = useState<{
    gateway: "cashfree" | "razorpay";
    payload: CashfreePayload | RazorpayPayload;
    orderId: string;
  } | null>(() => {
    try {
      const raw = sessionStorage.getItem("ambika.pending-pay");
      if (!raw) return null;
      const saved = JSON.parse(raw) as {
        gateway?: "cashfree" | "razorpay";
        payload: CashfreePayload | RazorpayPayload;
        orderId: string;
      };
      if (!saved?.payload?.orderId || !saved.orderId) return null;
      // Legacy entries predate the gateway tag — Razorpay payloads carry a
      // keyId, Cashfree ones a paymentSessionId.
      const gateway =
        saved.gateway ??
        ((saved.payload as CashfreePayload).paymentSessionId
          ? "cashfree"
          : "razorpay");
      return { gateway, payload: saved.payload, orderId: saved.orderId };
    } catch {
      return null;
    }
  });
  const firedMethods = useRef<Set<PaymentMethodId>>(new Set());
  const initiateFired = useRef(false);
  const prefilledFor = useRef<string | null>(null);
  /** Dedupes Cashfree verification — SDK builds fire callback, promise or both. */
  const cfHandledRef = useRef(false);
  const PENDING_KEY = "ambika.pending-pay";

  // Signed-in customers get their default address prefilled once.
  useEffect(() => {
    const def = user?.addresses.find((a) => a.isDefault) ?? user?.addresses[0];
    if (!def || prefilledFor.current === user?.id) return;
    prefilledFor.current = user?.id ?? null;
    setSelectedAddressId(def.id);
    setForm(addressToForm(def));
    setErrors({});
  }, [user]);

  // Signed-in customers get their email pre-filled for order updates.
  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  // ── Guest persistence (IndexedDB via Dexie) ──────────────────────────
  // Hydrate once: checkout draft + the address the guest opted to save.
  const [saveAddressNext, setSaveAddressNext] = useState(false);
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    void (async () => {
      const { dbGetDraft, dbGetGuestAddress, purgeExpired } = await import(
        "@/lib/guest-db"
      );
      void purgeExpired();
      // Guests only — signed-in users have their account address book.
      if (user) return;
      const [draft, saved] = await Promise.all([dbGetDraft(), dbGetGuestAddress()]);
      if (draft?.form && Object.keys(draft.form).length > 0) {
        setForm((prev) => ({ ...draft.form, ...prev }));
        if (draft.email) setEmail((prev) => prev || draft.email!);
        if (draft.paymentMethod) {
          setMethod(draft.paymentMethod);
          firedMethods.current.add(draft.paymentMethod);
        }
      }
      if (saved) {
        setForm((prev) => ({ ...prev, ...saved }));
        setSaveAddressNext(true); // they opted in before — keep it on
      }
    })();
  }, [user]);

  // Persist the draft (debounced) as the guest types.
  useEffect(() => {
    if (!user || !hydratedRef.current) return; // guests only, after hydration
    const id = setTimeout(() => {
      void import("@/lib/guest-db").then(({ dbSaveDraft }) =>
        dbSaveDraft({ form, paymentMethod: method, email: email || undefined }),
      );
    }, 600);
    return () => clearTimeout(id);
  }, [form, method, email, user]);

  function addressToForm(address: DeliveryAddress): FormState {
    return {
      fullName: address.fullName,
      phone: address.phone,
      pincode: address.pincode,
      line1: address.line1,
      landmark: address.landmark ?? "",
      city: address.city,
      state: address.state,
    };
  }

  function chooseAddress(address: AddressBookAddress | "manual") {
    if (address === "manual") {
      setSelectedAddressId("manual");
      return;
    }
    setSelectedAddressId(address.id);
    setForm(addressToForm(address));
    setErrors({});
  }

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
        // Rich items for GA4's checkout funnel reports.
        visibleItems.map((i) => ({
          item_id: i.slug,
          item_name: i.name ?? PRODUCT_INDEX[i.slug]?.name ?? i.slug,
          price: i.price ?? SITE.price,
          quantity: i.qty,
        })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleItems.length]);

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setSelectedAddressId("manual");
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

  const razorpayLive =
    activeClientGateway() === "razorpay" && razorpayClientLive();
  const isCashfreeUi = activeClientGateway() === "cashfree";

  /** POST the checkout success response to the server for verification. */
  const verifyPayment = async (
    resp: RazorpaySuccessResponse,
    orderId: string,
    amountPaise: number,
  ) => {
    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          gateway: "razorpay",
          razorpayOrderId: resp.razorpay_order_id,
          razorpayPaymentId: resp.razorpay_payment_id,
          razorpaySignature: resp.razorpay_signature,
          amountPaise,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order?: import("@/lib/types").Order;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.order) {
        // Verification could not confirm the payment. It may still have
        // succeeded on Razorpay's side (webhook pending) — the failure page
        // double-checks before showing the sad face. Keep the order saved so
        // "Retry Payment" resumes the exact same order.
        try {
          saveOrder({
            id: orderId,
            number: "",
            items: [],
            subtotal: 0,
            shipping: 0,
            total: amountPaise / 100,
            paymentMethod: "upi",
            paymentStatus: "pending",
            status: "placed",
            address: {
              fullName: "",
              phone: "",
              pincode: "",
              line1: "",
              city: "",
              state: "",
            },
            createdAt: new Date().toISOString(),
            estimatedDelivery: new Date().toISOString(),
            fulfilment: "pending",
            storedIn: "local" as const,
          });
        } catch {
          /* ignore */
        }
        router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
        return;
      }
      // Order is paid (server-verified) — only now do we save it, clear the
      // cart and show the success page (Purchase fires there).
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      saveOrder(data.order);
      clear();
      setPendingPay(null);
      router.replace(`/order-success?order=${encodeURIComponent(data.order.id)}`);
    } catch {
      router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
    } finally {
      setVerifying(false);
      setPlacing(false);
    }
  };

  /** Load checkout.js (once) and open the Razorpay payment widget. */
  const openRazorpay = async (payload: RazorpayPayload, orderId: string) => {
    setApiError(null);
    try {
      if (typeof window === "undefined" || !window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://checkout.razorpay.com/v1/checkout.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("gateway load failed"));
          document.head.appendChild(s);
        });
      }
    } catch {
      setApiError("Could not load the payment gateway — please retry.");
      setPlacing(false);
      return;
    }

    if (typeof window === "undefined" || !window.Razorpay) {
      setApiError("Payment gateway is unavailable — please retry.");
      setPlacing(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: payload.keyId,
      amount: payload.amountPaise,
      currency: payload.currency,
      name: payload.name,
      description: payload.description,
      order_id: payload.orderId,
      prefill: payload.prefill ?? {},
      theme: payload.theme ?? {},
      modal: { ondismiss: () => setPlacing(false) },
      handler: async (r?: Record<string, unknown>) => {
        await verifyPayment(
          {
            razorpay_payment_id: String(r?.razorpay_payment_id ?? ""),
            razorpay_order_id: String(r?.razorpay_order_id ?? ""),
            razorpay_signature: String(r?.razorpay_signature ?? ""),
          },
          orderId,
          payload.amountPaise,
        );
      },
    });
    rzp.on("payment.failed", (r?: Record<string, unknown>) => {
      setPlacing(false);
      const failure = r as { error?: { description?: string; reason?: string } } | undefined;
      setApiError(
        failure?.error?.description ||
          "Payment failed or was cancelled. Your order is saved — press Resume Payment to try again.",
      );
      // Straight to a proper failure page with the order reference. The
      // pending payment stays in session storage so Retry resumes this order.
      router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
    });
    rzp.open();
  };

  /** Load the Cashfree drop-in (once) and open its payment modal. */
  const openCashfree = async (payload: CashfreePayload, orderId: string) => {
    setApiError(null);
    cfHandledRef.current = false; // fresh attempt — callbacks may fire again
    try {
      if (typeof window === "undefined" || !window.Cashfree) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("gateway load failed"));
          document.head.appendChild(s);
        });
      }
    } catch {
      setApiError("Could not load the payment gateway — please retry.");
      setPlacing(false);
      return;
    }

    if (typeof window === "undefined" || !window.Cashfree) {
      setApiError("Payment gateway is unavailable — please retry.");
      setPlacing(false);
      return;
    }

    const mode = payload.mode === "production" ? "production" : "sandbox";
    const cf = new window.Cashfree({ mode });

    // First signal wins: some Cashfree SDK builds report the outcome via the
    // onSuccess/onFailure callbacks, some via the checkout() promise resolving
    // with a result object, and some via both. cfHandledRef dedupes them.
    const settle = () => {
      if (cfHandledRef.current) return;
      cfHandledRef.current = true;
      // Server is the source of truth — it re-fetches the order from the
      // Cashfree API and lands on success or the failure page either way.
      void verifyCashfreePayment(payload.orderId, orderId, payload.amountRupees);
    };
    const fail = (message?: string) => {
      if (cfHandledRef.current) return;
      cfHandledRef.current = true;
      setPlacing(false);
      setApiError(
        message ||
          "Payment failed or was cancelled. Your order is saved — press Resume Payment to try again.",
      );
      router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
    };

    // Closing the widget is not necessarily a failure (e.g. resuming an
    // already-paid session) — let the server decide by re-fetching status.
    const finish = () => {
      if (cfHandledRef.current) return;
      cfHandledRef.current = true;
      void verifyCashfreePayment(payload.orderId, orderId, payload.amountRupees);
    };

    try {
      const result = (await cf.checkout({
        paymentSessionId: payload.paymentSessionId,
        redirectTarget: "_modal",
        onSuccess: () => settle(),
        onFailure: (err?: { message?: string }) => finish(),
        onClose: () => finish(),
      })) as
        | {
            error?: { message?: string };
            order?: { status?: string; orderId?: string };
            payment?: { paymentId?: string; status?: string };
            redirect?: boolean;
          }
        | undefined;

      // Promise-resolved path (v3 drop-in): inspect the result object.
      if (result?.error) {
        fail(result.error.message);
        return;
      }
      // A redirect was initiated (bank/UPI-app page) — the return URL / webhook
      // completes the flow; nothing more to do here.
      if (result?.redirect) {
        return;
      }
      settle();
    } catch {
      // checkout() threw (config/load issue) — keep the pending order so the
      // customer can Resume Payment instead of creating a duplicate.
      setPlacing(false);
      if (!cfHandledRef.current) {
        setApiError("Payment window closed — press Resume Payment to try again.");
      }
    }
  };

  /** Cashfree verification: the server re-fetches status from the API. */
  const verifyCashfreePayment = async (
    cashfreeOrderId: string,
    orderId: string,
    amountRupees: number,
  ) => {
    setVerifying(true);
    try {
      const res = await fetch("/api/payments/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          gateway: "cashfree",
          cashfreeOrderId,
          amountPaise: Math.round(amountRupees * 100),
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order?: import("@/lib/types").Order;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.order) {
        // Verification could not confirm the payment. It may still have
        // succeeded on Cashfree's side (webhook pending) — the failure page
        // double-checks before showing the sad face. Keep the order saved so
        // "Retry Payment" resumes the exact same order.
        try {
          saveOrder({
            id: orderId,
            number: "",
            items: [],
            subtotal: 0,
            shipping: 0,
            total: amountRupees,
            paymentMethod: "upi",
            paymentStatus: "pending",
            status: "placed",
            address: {
              fullName: "",
              phone: "",
              pincode: "",
              line1: "",
              city: "",
              state: "",
            },
            createdAt: new Date().toISOString(),
            estimatedDelivery: new Date().toISOString(),
            fulfilment: "pending",
            storedIn: "local" as const,
          });
        } catch {
          /* ignore */
        }
        router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
        return;
      }
      // Order is paid (server-verified) — only now do we save it, clear the
      // cart and show the success page (Purchase fires there).
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }
      saveOrder(data.order);
      clear();
      setPendingPay(null);
      router.replace(`/order-success?order=${encodeURIComponent(data.order.id)}`);
    } catch {
      router.replace(`/order-failure?order=${encodeURIComponent(orderId)}`);
    } finally {
      setVerifying(false);
      setPlacing(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    // Resume an interrupted payment against the same order (no duplicate).
    if (pendingPay) {
      setPlacing(true);
      if (pendingPay.gateway === "cashfree") {
        await openCashfree(
          pendingPay.payload as CashfreePayload,
          pendingPay.orderId,
        );
      } else {
        await openRazorpay(
          pendingPay.payload as RazorpayPayload,
          pendingPay.orderId,
        );
      }
      return;
    }

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
          address: {
            ...check.address,
            whatsapp:
              whatsappSame
                ? check.address.phone
                : whatsapp.trim() || check.address.phone,
          },
          paymentMethod: method,
          utm: readUtmFromUrl(),
          email: email.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        order?: import("@/lib/types").Order;
        razorpay?: RazorpayPayload;
        cashfree?: CashfreePayload;
        error?: string;
        fieldErrors?: AddressErrors;
      };
      if (!res.ok || !data.ok || !data.order) {
        setApiError(data.error ?? "Could not place your order — please try again.");
        if (data.fieldErrors) setErrors((prev) => ({ ...prev, ...data.fieldErrors }));
        return;
      }

      // Guest persistence: remember/forget the address per the opt-in, and
      // clear the checkout draft — the order is with the server now.
      void (async () => {
        const { dbSaveGuestAddress, dbClearGuestAddress, dbClearDraft, dbSetCart } =
          await import("@/lib/guest-db");
        if (saveAddressNext && check.address) {
          await dbSaveGuestAddress(check.address);
        } else {
          await dbClearGuestAddress();
        }
        await dbClearDraft();
        await dbSetCart([]); // local cart mirrors the cleared cart
      })();

      // Live payment: hold the order as pending and open the gateway widget.
      if (data.cashfree?.paymentSessionId) {
        const pending = {
          gateway: "cashfree" as const,
          payload: data.cashfree,
          orderId: data.order.id,
        };
        setPendingPay(pending);
        try {
          // Persist so "Retry Payment" on the failure page resumes this
          // exact order + payment instead of creating a duplicate.
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        } catch {
          /* ignore */
        }
        await openCashfree(data.cashfree, data.order.id);
        return;
      }
      if (data.razorpay?.orderId && razorpayLive) {
        const pending = {
          gateway: "razorpay" as const,
          payload: data.razorpay,
          orderId: data.order.id,
        };
        setPendingPay(pending);
        try {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
        } catch {
          /* ignore */
        }
        await openRazorpay(data.razorpay, data.order.id);
        return;
      }

      // Fresh (COD / demo) order — no pending gateway payment to resume.
      try {
        sessionStorage.removeItem(PENDING_KEY);
      } catch {
        /* ignore */
      }

      // Demo / COD: order is placed immediately.
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
      {razorpayLive ? (
        <p className="mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] leading-5 text-ink2">
          <strong className="text-ink">Secure checkout:</strong> payments are
          processed by <strong>Razorpay</strong> — UPI, cards and net banking.
          Your order is confirmed only after the payment verifies.
        </p>
      ) : isCashfreeUi ? (
        <p className="mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-[13px] leading-5 text-ink2">
          <strong className="text-ink">Secure checkout:</strong> payments are
          processed by <strong>Cashfree</strong> — UPI, cards and net banking.
          Your order is confirmed only after the payment verifies.
        </p>
      ) : (            isDemoMode() && (
              <p className="mb-6 rounded-xl border border-bronze/40 bg-bronze/10 px-4 py-3 text-[13px] leading-5 text-ink2">
                <strong className="text-ink">Demo checkout:</strong> no real payment
                is processed — UPI / cards / net banking orders are simulated and
                marked paid so you can test the full funnel. Enable Cashfree via the
                env keys in <code className="rounded bg-surface px-1">.env.example</code>{" "}
                when going live.
              </p>
            )
      )}

      {pendingPay && !verifying && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2.5 rounded-xl border border-bronze/40 bg-bronze/10 px-4 py-3 text-sm font-semibold text-ink2"
        >
          <Info size={18} className="mt-0.5 shrink-0 text-bronze" />
          Payment window closed — your order is saved. Press Resume Payment to
          continue paying.
        </div>
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

            {user && user.addresses.length > 0 && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink">
                    Choose saved address
                  </p>
                  <button
                    type="button"
                    onClick={() => chooseAddress("manual")}
                    className="text-xs font-semibold text-accent underline underline-offset-4"
                  >
                    Use a different address
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {user.addresses.map((address) => {
                    const active = selectedAddressId === address.id;
                    return (
                      <button
                        key={address.id}
                        type="button"
                        onClick={() => chooseAddress(address)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          active
                            ? "border-accent bg-accent/10 ring-1 ring-accent/40"
                            : "border-line bg-bg/40 hover:border-accent/50"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm font-bold text-ink">
                          <MapPin size={16} className="text-bronze" />
                          {address.label ?? "Saved address"}
                          {address.isDefault && (
                            <span className="rounded-full bg-[#4c7a4f]/15 px-2 py-0.5 text-[10px] font-bold text-[#3f6b43]">
                              Primary
                            </span>
                          )}
                        </span>
                        <span className="mt-2 block text-xs leading-5 text-ink2">
                          {address.fullName} · {address.line1}
                          {address.landmark ? `, ${address.landmark}` : ""}, {address.city}, {address.state} {address.pincode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
              <Field
                label="Email (optional)"
                hint="Order confirmation & shipping updates by email"
              >
                <TextInput
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#e2448f]"
                    checked={whatsappSame}
                    onChange={(e) => {
                      setWhatsappSame(e.target.checked);
                      if (e.target.checked) setWhatsapp("");
                    }}
                  />
                  <span>
                    Send order & shipping updates on WhatsApp —{" "}
                    <span className="font-semibold text-ink">
                      same as mobile number
                    </span>
                  </span>
                </label>
                {!whatsappSame && (
                  <div className="mt-3">
                    <Field
                      label="WhatsApp Number"
                      hint="Where we'll send order, shipping & delivery updates"
                    >
                      <TextInput
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        placeholder="98765 43210"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                    </Field>
                  </div>
                )}
              </div>
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
              {!user && (
                <div className="sm:col-span-2">
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-xl bg-bg2 px-4 py-3 text-[13px] text-ink2">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 accent-[#e2448f]"
                      checked={saveAddressNext}
                      onChange={(e) => setSaveAddressNext(e.target.checked)}
                    />
                    <span>
                      <span className="font-semibold text-ink">
                        Use this address for my next order
                      </span>{" "}
                      — saved only on this device (we keep it 30 days, never on
                      our servers unless you create an account).
                    </span>
                  </label>
                </div>
              )}
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
            {method !== "cod" && !razorpayLive && isDemoMode() && (
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
                    <WornThumb
                      slug={line.slug}
                      colorway={meta?.colorway ?? line.color}
                      category={meta?.category}
                      name={line.name}
                      image={line.image}
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
              <dd className="flex items-center gap-1.5 font-semibold text-ink">
                <s className="text-xs text-muted">{formatINR(SITE.shippingFee)}</s>
                <span className="text-[#4c7a4f]">FREE</span>
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
            disabled={placing || verifying}
          >
            {verifying ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Verifying payment…
              </>
            ) : placing ? (
              <>
                <Loader2 size={18} className="animate-spin" />{" "}
                {pendingPay ? "Resuming…" : "Placing order…"}
              </>
            ) : pendingPay ? (
              `Resume Payment · ${formatINR(summary.total)}`
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
            disabled={placing || verifying}
          >
            {verifying ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Verifying…
              </>
            ) : placing ? (
              <>
                <Loader2 size={17} className="animate-spin" />{" "}
                {pendingPay ? "Resuming…" : "Placing…"}
              </>
            ) : pendingPay ? (
              "Resume Payment"
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
