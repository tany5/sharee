# Transactional Email (Resend)

Order/payment/shipping emails are sent through [Resend](https://resend.com) via
its REST API — no SDK dependency. The module is `lib/email.ts` (server-only).

## Configuration (`.env.local`)

```bash
RESEND_API_KEY=re_xxxxxxxx                       # resend.com/api-keys
EMAIL_FROM="TheTanti <orders@thetanti.shop>"     # requires domain verification
# EMAIL_BCC=owner@thetanti.com                   # optional copy of every email
# EMAIL_ENABLED=0                                # kill-switch (default: on)
```

**Deliverability (done — keep it this way):** `thetanti.shop` is verified in
Resend (DKIM `resend._domainkey`, SPF on `send.thetanti.shop`, MAIL FROM MX all
resolve), and `EMAIL_FROM` is `orders@thetanti.shop`. Never send production
email from `onboarding@resend.dev` — that is Resend's sandbox sender: it can
only reach the Resend account's own inbox and is filtered as spam everywhere
else. If email suddenly lands in spam again, check, in order: the From address
is on the verified domain, the Resend domain still shows Verified, and SPF is
not duplicated on the apex (Cloudflare's own `_spf.mx.cloudflare.net` must stay
the only apex SPF record).

## Events wired

| Trigger | Email | Sent from |
| --- | --- | --- |
| Order placed — COD or demo-paid | 🥻 Order confirmation (pay-on-delivery amount) | `POST /api/orders` |
| Order placed — online gateway | *(none — replaced by the payment email)* | — |
| Payment verified (Cashfree/Razorpay) | 💳 Payment received | `/api/payments/verify` + gateway webhooks (deduped per order) |
| Admin sets fulfilment status | 🚚 shipped / ❤️ delivered / 🚫 cancelled | `PATCH /api/admin/orders/[id]` |
| Account registered | 🎉 Welcome | `POST /api/auth/register` |

## Guarantees

- **Fire-and-forget** — email failures are logged (grep `dev-server.log` for
  `[email]`) and never fail an order, a payment, or an admin action.
- **One payment email per order** — the verify route and the gateway webhook
  can both confirm the same payment; only the first successful send wins.
- **Guest-friendly** — the checkout form has an optional Email field; it's
  stored as `user_email` on the order and used for all updates.
- **Unsubscribe-safe** — these are strictly transactional (order/payment/
  shipping), which is exempt from most marketing-consent rules. Keep it that
  way: don't add promo content to these templates.

## Owner alerts

Every new order and every confirmed payment also alerts the shop owner:

- **Email** — `OWNER_EMAIL` receives a plain-text copy via Resend (same
  sender as customer emails, deduped per order per event).
- **WhatsApp** — `OWNER_WHATSAPP` receives the same alert through the
  official WhatsApp Cloud API when `WHATSAPP_PHONE_NUMBER_ID` is configured
  (token: `WHATSAPP_TOKEN`, or the Meta system-user token from
  `secret/secret/meta.txt`); otherwise through the free CallMeBot bridge
  using `OWNER_WHATSAPP_APIKEY`. Setup steps are in `.env.example`.

Alerts are fire-and-forget: they never delay or fail an order. Add or change
recipients in `.env.local` (`OWNER_EMAIL`, `OWNER_WHATSAPP`).

## Templates

One shared 600px HTML shell (inline styles, Gmail-safe): brand logo, item
table, totals with the ~~₹49~~ FREE shipping row, Track-My-Order button,
contact footer. A plain-text alternative is generated for each email.

**Logo:** every template embeds `{{logo_url}}` = `EMAIL_LOGO_URL` or, by
default, `${SITE.url}/logo/logo.png`. The URL must be publicly reachable (it is
embedded in customers' inboxes, not served by the app): after changing it, run
`curl -I <url>` and expect HTTP 200. Do not reference `/email-logo.png` unless
that file is committed AND the site is redeployed — a 404 renders as a broken
image. See `lib/email-templates/render.ts::emailLogoUrl()`.

---

## WhatsApp customer updates — making delivery reliable

Free-form WhatsApp texts are ONLY delivered when the customer messaged the
business number within the last 24 hours (Meta's customer-service window).
Customers placing a first order are almost always outside that window, so
without a template the customer confirmation is silently rejected (Meta error
131047) while the owner alert and emails still work.

Reliable path (one-time setup):

1. Meta Business Suite → WhatsApp Manager → **Message templates → Create**:
   - Name: `order_update_v1`, Category: **Utility**, Language: English
   - Body:
     ```
     🥻 TheTanti order update
     Hi {{1}}, your order {{2}} (₹{{3}}) is {{4}}.
     Questions? Just reply to this message.
     ```
     `{{1}}` customer first name · `{{2}}` order number · `{{3}}` total ·
     `{{4}}` status line (confirmed/paid/shipped/delivered/cancelled)
2. Wait for Meta approval (usually minutes for Utility templates).
3. Set env on Vercel (and `.env.local`):
   - `WHATSAPP_TEMPLATE_NAME=order_update_v1`
   - `WHATSAPP_TEMPLATE_LANG=en` (must match the template's language)
4. Also required: `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_TOKEN` (or the Meta
   system-user token from `secret/secret/meta.txt` as the fallback).

With the template set, order events send the template first and fall back to
free-form text when the 24h window is open. Without it, behaviour is
unchanged (free-form attempt, logged rejection). Verify any time with the
**Admin → Notifications → Send test alert** button, which reports the exact
upstream error per channel.

Vercel env checklist for the full notification stack: `RESEND_API_KEY`,
`EMAIL_FROM`, `OWNER_EMAIL`, `OWNER_WHATSAPP`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, optional
`OWNER_WHATSAPP_APIKEY` (CallMeBot backup for the owner channel),
`WHATSAPP_WEBHOOK_VERIFY_TOKEN` + the Meta webhook pointed at
`/api/webhooks/whatsapp`.
