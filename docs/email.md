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

**Test mode:** until `thetanti.shop` is verified in Resend → Domains, keep
`EMAIL_FROM="TheTanti <onboarding@resend.dev>"`. That address can only deliver
to the Resend account's own email (`tanmay1dey@gmail.com`); sends to customers
return HTTP 403. Verify the domain (add the DNS records Resend shows), then
switch the From address — every email below then reaches real customers.

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

## Templates

One shared 600px HTML shell (inline styles, Gmail-safe): brand header
("ALL SAREES ₹199 · FREE SHIPPING ALL OVER INDIA"), item table, totals with
the ~~₹49~~ FREE shipping row, Track-My-Order button, contact footer. A plain-
text alternative is generated for each email.
