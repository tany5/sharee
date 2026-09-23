import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ordersForUser } from "@/lib/backend";
import { currentUser } from "@/lib/auth/session";
import { InvoiceDocument } from "@/components/order/invoice-document";
import { PrintButton } from "@/components/order/print-button";
import { toTrackedOrder } from "@/lib/tracking";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

/**
 * Signed-in customer invoice. Ownership is enforced the same way as
 * /api/account/orders: the order must belong to the signed-in user. Guests
 * use the phone-verified /track flow instead.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect(`/account?next=/account/orders/${id}/invoice`);

  const orders = await ordersForUser(user.id);
  const order = orders.find((o) => o.id === id || o.number === id);
  if (!order) notFound();

  const view = toTrackedOrder(order);
  return (
    <div className="tt-print-area mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold text-ink">
          Invoice {order.number}
        </h1>
        <PrintButton />
      </div>
      <InvoiceDocument order={view} />
    </div>
  );
}
