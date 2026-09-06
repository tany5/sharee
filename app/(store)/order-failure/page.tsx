import type { Metadata } from "next";
import { OrderFailureView } from "@/components/order/order-failure-view";
import { pageMetadata } from "@/lib/meta";

export const metadata: Metadata = pageMetadata({
  title: "Payment Not Completed",
  description:
    "Your payment was not completed. Retry the payment or get in touch — your sarees are reserved in your cart.",
  path: "/order-failure",
});

export default async function OrderFailurePage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OrderFailureView id={order ?? ""} />
    </div>
  );
}