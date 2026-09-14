import type { Metadata } from "next";
import { OrderSuccessView } from "@/components/order/order-success-view";
import { utilityMetadata } from "@/lib/meta";

export const metadata: Metadata = utilityMetadata({
  title: "Order Confirmed",
  description:
    "Your saree order is confirmed. Track delivery and get back to shopping — all sarees are ₹199.",
  path: "/order-success",
});

export default async function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <OrderSuccessView id={order ?? ""} />
    </div>
  );
}
