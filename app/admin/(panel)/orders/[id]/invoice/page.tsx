import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findOrderById } from "@/lib/backend";
import { requireAdmin } from "@/lib/admin/guard";
import { InvoiceDocument } from "@/components/order/invoice-document";
import { PrintButton } from "@/components/order/print-button";
import { toTrackedOrder } from "@/lib/tracking";

export const metadata: Metadata = {
  title: "Invoice",
  robots: { index: false, follow: false },
};

/** Admin invoice print view — reuses the shared document for any order. */
export default async function AdminInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  const order = await findOrderById(id);
  if (!order) notFound();

  return (
    <div className="tt-print-area mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold text-ink">
          Invoice {order.number}
        </h1>
        <PrintButton />
      </div>
      <InvoiceDocument order={toTrackedOrder(order)} />
    </div>
  );
}
