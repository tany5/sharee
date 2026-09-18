# Payments — Cashfree (active) + Razorpay (kept intact)

The store supports two payment gateways behind one env-driven switch. **Cashfree
is the active gateway**; Razorpay remains fully implemented and can be restored
with a single env var.

## Switching gateways

| `PAYMENT_GATEWAY` | Behaviour |
| --- | --- |
| `cashfree` | Cashfree is used (current default in `.env.example`) |
| `razorpay` | Razorpay is used — previous integration, untouched |
| *(unset)* | Auto-detect: Cashfree when `CASHFREE_APP_ID` + `CASHFREE_SECRET_KEY` are set, otherwise Razorpay |

Single decision point: `lib/payments/gateway.ts` (`activeGateway()`).
The checkout banner copy follows `NEXT_PUBLIC_PAYMENT_GATEWAY` (falls back to
Razorpay only when `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set) — see
`lib/payments/client.ts` (`activeClientGateway()`).

## Cashfree environment keys

```bash
PAYMENT_GATEWAY=cashfree   # active gateway
CASHFREE_APP_ID=           # Merchant Dashboard → API keys
CASHFREE_SECRET_KEY=       # Merchant Dashboard → API keys
CASHFREE_ENV=sandbox       # "sandbox" (default) or "production"
```

Keys live in `.env.local` (git-ignored). `.env.example` documents every one.
The block is already appended to `.env.local` — paste the App ID + Secret and
restart the dev server.

## Cashfree integration map

| Piece | File |
| --- | --- |
| Order creation (`POST /pg/orders`), status fetch, webhook HMAC | `lib/payments/cashfree.ts` |
| Client payload + drop-in typings (`paymentSessionId`) | `lib/payments/client.ts` |
| Gateway branching at order time | `app/api/orders/route.ts` |
| Server-side verification | `app/api/payments/verify/route.ts` |
| Webhook receiver | `app/api/webhooks/cashfree/route.ts` |
| Demo-store confirmation | `lib/demo/db.ts` (`confirmCashfreePayment`) |
| Supabase confirmation | `lib/supabase/backend.ts` + `supabase/migrations/0010_cashfree_gateway.sql` |
| Checkout modal + resume-payment flow | `components/checkout/checkout-view.tsx` |

## Payment flow (Cashfree)

1. **Order creation** — `POST /api/orders` validates the basket, creates the
   order as `paymentStatus: "pending"`, then calls Cashfree `POST /pg/orders`
   with a `tt_<orderId>` merchant id, the customer details and
   `notify_url = <SITE.url>/api/webhooks/cashfree`. The `payment_session_id`
   is returned to the client.
2. **Checkout** — the client loads `https://sdk.cashfree.com/js/v3/cashfree.js`
   and opens the drop-in modal (`redirectTarget: "_modal"`) with the session id.
   The modal `mode` matches `CASHFREE_ENV` (sandbox/production must agree —
   the usual cause of "invalid sessionId").
3. **Verification** — the modal callback is *not* cryptographically signed, so
   `POST /api/payments/verify` re-fetches the order from the Cashfree API
   (`GET /pg/orders/{id}` + payments list) and settles only on `PAID` (or a
   `PENDING` late-authorisation payment) with an amount matching the order
   total. Confirmation goes through `confirm_cashfree_payment` (Supabase) or
   `confirmCashfreePayment` (demo store), both idempotent and amount-checked.
4. **Webhook** — Cashfree POSTs events to `/api/webhooks/cashfree`, verified
   as `base64(HMAC-SHA256("<x-webhook-timestamp>.<rawBody>", secret))`. Only
   `PAYMENT_SUCCESS` / `payment.captured` events with a matching amount flip
   the order to paid.

Purchase analytics fires only on `/order-success` for `paymentStatus: "paid"`
orders, exactly as before.

## Going live checklist (Cashfree)

1. Run `supabase/migrations/0010_cashfree_gateway.sql` in the Supabase SQL
   editor (adds `cashfree_order_id` / `cashfree_payment_id` columns + the
   `confirm_cashfree_payment` RPC).
2. Fill `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` in `.env.local` (or the host's
   env settings) and set `CASHFREE_ENV=production`.
3. Optionally seed the DB secret used for in-SQL verification:
   `insert into public.app_secrets (name, value) values ('cashfree_secret_key', '<secret>') on conflict (name) do update set value = excluded.value;`
4. Register the webhook in the Cashfree dashboard → the notify URL set at order
   creation (`https://<your-domain>/api/webhooks/cashfree`), event
   **PAYMENT_SUCCESS**.
5. Sandbox-test with Cashfree's test UPI/cards, then switch `CASHFREE_ENV`.

## Switching back to Razorpay

Set `PAYMENT_GATEWAY=razorpay` and restore the Razorpay env keys
(`NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`). No code changes; the old checkout widget, verify
route and webhook are untouched.

## Tests

`npm test` covers the payment modules in `lib/payments/*.test.ts` — Razorpay
signature/webhook verification, Cashfree order creation, API status fetch,
webhook HMAC and gateway selection.
