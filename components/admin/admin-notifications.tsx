"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BellRing, CheckCircle2, Loader2, Mail, MessageCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Notification-channel health card (admin dashboard).
 *
 * Shows the live server-side config for the customer/owner email + WhatsApp
 * channels and fires a real test alert so production problems are visible
 * (order paths swallow notification errors by design — this is the window
 * into them).
 */
interface Status {
  email: {
    configured: boolean;
    hasKey: boolean;
    keyPreview: string | null;
    from: string;
    fromIsResendSandbox: boolean;
    ownerEmail: string | null;
  };
  whatsapp: {
    customerChannelConfigured: boolean;
    cloudApiPhoneId: string | null;
    ownerNumber: string | null;
    hasCallMeBotKey: boolean;
  };
  ownerAlertsReady: boolean;
}

interface TestResult {
  overall: boolean;
  email: { attempted: boolean; sent: boolean; error?: string };
  whatsapp: { attempted: boolean; sent: boolean; channel: string; error?: string };
}

function Dot({ ok, warn }: { ok: boolean; warn?: boolean }) {
  if (ok) return <CheckCircle2 size={15} className="text-green-600" />;
  if (warn) return <AlertTriangle size={15} className="text-amber-500" />;
  return <XCircle size={15} className="text-red-500" />;
}

export function AdminNotificationsCard() {
  const [status, setStatus] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/notifications", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ ok?: boolean; email?: Status["email"]; whatsapp?: Status["whatsapp"]; ownerAlertsReady?: boolean }>)
      .then((d) => {
        if (d.email && d.whatsapp) setStatus(d as unknown as Status);
        else setError("Could not load status");
      })
      .catch(() => setError("Could not load status"));
  }, []);

  const sendTest = useCallback(() => {
    setTesting(true);
    setResult(null);
    setError(null);
    fetch("/api/admin/notifications", { method: "POST" })
      .then((r) => r.json() as Promise<{ ok?: boolean; result?: TestResult; error?: string }>)
      .then((d) => {
        if (d.result) setResult(d.result);
        else setError(d.error ?? "Test failed");
      })
      .catch(() => setError("Test request failed"))
      .finally(() => setTesting(false));
  }, []);

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BellRing size={17} className="text-bronze" />
        <h2 className="text-lg text-ink">Notification channels</h2>
        <span className="ml-auto text-xs text-muted">
          owner alerts · customer email &amp; WhatsApp
        </span>
      </div>

      {error && !status ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : !status ? (
        <Loader2 size={18} className="animate-spin text-muted" />
      ) : (
        <>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center gap-2.5">
              <Dot ok={status.email.configured} warn={status.email.fromIsResendSandbox} />
              <Mail size={14} className="text-muted" />
              <span className="text-ink">
                Customer + owner email{" "}
                <span className="text-muted">
                  ({status.email.hasKey ? `key ${status.email.keyPreview}` : "RESEND_API_KEY missing"}) · from{" "}
                  <code className="text-xs">{status.email.from}</code>
                </span>
              </span>
            </li>
            {status.email.fromIsResendSandbox && (
              <li className="ml-6 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Sender is the Resend sandbox — set <code>EMAIL_FROM=&quot;TheTanti &lt;orders@thetanti.shop&gt;&quot;</code>{" "}
                in production or mail is filtered as spam.
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <Dot ok={Boolean(status.email.ownerEmail)} />
              <Mail size={14} className="text-muted" />
              <span className="text-ink">
                Owner alert email{" "}
                <span className="text-muted">{status.email.ownerEmail ?? "OWNER_EMAIL not set"}</span>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <Dot ok={Boolean(status.whatsapp.cloudApiPhoneId)} warn={status.whatsapp.hasCallMeBotKey} />
              <MessageCircle size={14} className="text-muted" />
              <span className="text-ink">
                WhatsApp{" "}
                <span className="text-muted">
                  {status.whatsapp.cloudApiPhoneId
                    ? `Cloud API (${status.whatsapp.cloudApiPhoneId})`
                    : status.whatsapp.hasCallMeBotKey
                      ? "CallMeBot fallback"
                      : `no channel — OWNER_WHATSAPP ${status.whatsapp.ownerNumber ?? "not set"} but neither WHATSAPP_PHONE_NUMBER_ID nor OWNER_WHATSAPP_APIKEY is configured`}
                </span>
              </span>
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button size="sm" onClick={sendTest} disabled={testing}>
              {testing ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
              Send test alert
            </Button>
            {result && (
              <span className="text-xs text-muted">
                Email:{" "}
                <b className={result.email.sent ? "text-green-600" : "text-red-500"}>
                  {result.email.sent ? "delivered" : result.email.error ?? "not attempted"}
                </b>
                {" · "}
                WhatsApp:{" "}
                <b className={result.whatsapp.sent ? "text-green-600" : "text-red-500"}>
                  {result.whatsapp.sent
                    ? `delivered (${result.whatsapp.channel})`
                    : result.whatsapp.error ?? "not attempted"}
                </b>
              </span>
            )}
            {error && <span className="text-xs text-red-500">{error}</span>}
          </div>
        </>
      )}
    </section>
  );
}
