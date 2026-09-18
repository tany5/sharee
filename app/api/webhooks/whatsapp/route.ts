import { NextResponse } from "next/server";

/**
 * WhatsApp Cloud API webhook — Meta's event endpoint for the business number.
 *
 * GET  (verification): Meta calls this once when you save the webhook in the
 *      App Dashboard, sending hub.mode/hub.verify_token/hub.challenge.
 *      Respond 200 with the raw challenge iff the token matches
 *      WHATSAPP_WEBHOOK_VERIFY_TOKEN. NOTE: Meta must be able to REACH this
 *      URL — configure the dashboard entry only after this build is deployed
 *      (locally, use the dashboard's "Test" button against a tunnel).
 *
 * POST (events): inbound customer messages (which OPEN the 24-hour free-form
 *      window we rely on) and message status updates (sent/delivered/read/
 *      failed — the failed reasons are invaluable for debugging templates).
 *      Signature verification is done in a follow-up via
 *      X-Hub-Signature-256 + META_APP_SECRET; for now we only accept
 *      well-formed payloads and log them.
 */

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && token && expected && token === expected) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

interface WaWebhookBody {
  object?: string;
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          from?: string;
          type?: string;
          text?: { body?: string };
        }[];
        statuses?: {
          id?: string;
          status?: string;
          recipient_id?: string;
          errors?: { title?: string; message?: string }[];
        }[];
      };
    }[];
  }[];
}

export async function POST(request: Request) {
  let body: WaWebhookBody;
  try {
    body = (await request.json()) as WaWebhookBody;
  } catch {
    return NextResponse.json({ ok: true }); // never retry-bait Meta
  }

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};

      // Inbound customer message → the 24h free-form window is now open.
      for (const msg of value.messages ?? []) {
        console.log(
          `[whatsapp-webhook] inbound from ${msg.from ?? "?"} (${msg.type}): ${(msg.text?.body ?? "").slice(0, 80)}`,
        );
      }

      // Delivery statuses — log failures loudly (template/window problems).
      for (const st of value.statuses ?? []) {
        if (st.status === "failed") {
          console.error(
            `[whatsapp-webhook] FAILED to ${st.recipient_id ?? "?"}: ${st.errors?.[0]?.title ?? ""} ${st.errors?.[0]?.message ?? ""}`,
          );
        } else {
          console.log(`[whatsapp-webhook] status ${st.status} → ${st.recipient_id ?? "?"}`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
