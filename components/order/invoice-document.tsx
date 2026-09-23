import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { TrackedOrder } from "@/lib/tracking";

/**
 * Print-friendly invoice (bill-of-supply style — the store is not
 * GST-registered, so there is no tax breakup; the total is inclusive).
 *
 * One presentational component shared by three surfaces:
 *   • /account signed-in order history ("Print invoice" link)
 *   • /track (guest path — renders straight from the verified API payload)
 *   • the browser's Print → Save-as-PDF flow replaces a PDF library (₹0)
 *
 * Print rules live in app/globals.css under `@media print` (site chrome is
 * hidden, the invoice fills an A4 sheet).
 */

const methodLabel: Record<string, string> = {
  upi: "UPI",
  card: "Card (Credit / Debit)",
  netbanking: "Net Banking",
  cod: "Cash on Delivery",
};

const statusLabel: Record<string, string> = {
  paid: "Paid",
  pending: "Pending",
  cod: "Payable on delivery",
};

export function InvoiceDocument({ order }: { order: TrackedOrder }) {
  const qtyTotal = order.items.reduce((s, it) => s + it.qty, 0);
  return (
    <article className="tt-invoice mx-auto w-full max-w-3xl rounded-panel border border-line bg-white p-8 text-[13px] leading-5 text-neutral-900 sm:p-10">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-5">
        <div>
          <p className="font-display text-2xl font-bold text-neutral-900">
            {SITE.name}
          </p>
          <p className="mt-1 text-[12px] text-neutral-600">
            {SITE.address}
          </p>
          <p className="text-[12px] text-neutral-600">
            {SITE.email} · {SITE.phone}
          </p>
          <p className="text-[12px] text-neutral-600">{SITE.url.replace(/^https?:\/\//, "")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
            Invoice / Bill of Supply
          </p>
          <p className="mt-1 font-mono text-sm font-bold">{order.number}</p>
          <p className="text-[12px] text-neutral-600">
            Date: {formatDateSafe(order.createdAt)}
          </p>
          <p className="text-[12px] text-neutral-600">
            Payment: {methodLabel[order.paymentMethod] ?? order.paymentMethod} ·{" "}
            {statusLabel[order.paymentStatus] ?? order.paymentStatus}
          </p>
        </div>
      </header>

      {/* Bill to */}
      <section className="mt-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
          Billed / shipped to
        </p>
        <address className="mt-1.5 not-italic">
          <p className="font-bold">{order.address.fullName}</p>
          <p>
            {order.address.line1}
            {order.address.landmark ? `, ${order.address.landmark}` : ""}
          </p>
          <p>
            {order.address.city}, {order.address.state} — {order.address.pincode}
          </p>
          <p>{order.address.phone}</p>
        </address>
      </section>

      {/* Items */}
      <table className="mt-6 w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-neutral-300 text-[11px] uppercase tracking-wider text-neutral-500">
            <th className="py-2 pr-2 font-bold">Item</th>
            <th className="py-2 pr-2 font-bold">Colour</th>
            <th className="py-2 pr-2 text-right font-bold">Qty</th>
            <th className="py-2 pr-2 text-right font-bold">Rate</th>
            <th className="py-2 text-right font-bold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((it, i) => (
            <tr key={`${it.name}-${i}`} className="border-b border-neutral-200">
              <td className="py-2 pr-2 font-medium">{it.name}</td>
              <td className="py-2 pr-2">{it.color}</td>
              <td className="py-2 pr-2 text-right">{it.qty}</td>
              <td className="py-2 pr-2 text-right">{formatINR(it.price)}</td>
              <td className="py-2 text-right font-semibold">
                {formatINR(it.price * it.qty)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <section className="mt-5 flex justify-end">
        <dl className="w-full max-w-64 space-y-1.5">
          <div className="flex justify-between">
            <dt className="text-neutral-600">Subtotal ({qtyTotal} item{qtyTotal === 1 ? "" : "s"})</dt>
            <dd className="font-semibold">{formatINR(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-neutral-600">Shipping</dt>
            <dd className="font-semibold">
              {order.shipping === 0 ? "FREE" : formatINR(order.shipping)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-neutral-900 pt-2 text-base">
            <dt className="font-bold">Total</dt>
            <dd className="font-display font-bold">{formatINR(order.total)}</dd>
          </div>
        </dl>
      </section>

      {/* Footer */}
      <footer className="mt-8 border-t border-neutral-200 pt-4 text-[11px] leading-4 text-neutral-500">
        <p>
          All prices are inclusive of taxes. This is a computer-generated
          invoice for order {order.number}; no signature is required.
        </p>
        <p className="mt-1">
          Thank you for shopping with {SITE.name} — questions? {SITE.email} or
          WhatsApp {SITE.phone}.
        </p>
      </footer>
    </article>
  );
}

function formatDateSafe(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}
