import { NextResponse } from "next/server";
import { requireAdmin, unauthorized } from "@/lib/admin/guard";
import {
  emailFrom,
  isEmailLive,
  resendApiKey,
} from "@/lib/email";
import { isWhatsAppLive, whatsappPhoneId } from "@/lib/notify";
import {
  isOwnerAlertConfigured,
  ownerEmail,
  ownerWhatsApp,
  sendOwnerTestAlert,
} from "@/lib/owner";

/**
 * Notification channel diagnostics (admin-only).
 *
 * GET  → which channels are configured/reachable right now. Never returns
 *        secret values — only presence/absence and safe fragments.
 * POST → fires a test owner alert (WhatsApp + email) and returns the raw
 *        per-channel result including the upstream error text, so delivery
 *        problems on production are visible instead of being swallowed by
 *        the fire-and-forget order paths.
 */
export async function GET() {
  if (!(await requireAdmin())) return unauthorized();

  const key = resendApiKey();
  return NextResponse.json({
    email: {
      configured: isEmailLive(),
      hasKey: Boolean(key),
      keyPreview: key ? `${key.slice(0, 5)}…${key.slice(-4)}` : null,
      from: emailFrom(),
      fromIsResendSandbox: emailFrom().includes("onboarding@resend.dev"),
      ownerEmail: ownerEmail() ?? null,
    },
    whatsapp: {
      customerChannelConfigured: isWhatsAppLive(),
      cloudApiPhoneId: whatsappPhoneId() ?? null,
      ownerNumber: ownerWhatsApp() ?? null,
      hasCallMeBotKey: Boolean(process.env.OWNER_WHATSAPP_APIKEY?.trim()),
    },
    ownerAlertsReady: isOwnerAlertConfigured(),
  });
}

export async function POST() {
  if (!(await requireAdmin())) return unauthorized();

  const result = await sendOwnerTestAlert();
  return NextResponse.json({ ok: result.overall, result });
}
