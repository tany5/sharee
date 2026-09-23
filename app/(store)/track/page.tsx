import type { Metadata } from "next";
import { TrackView } from "@/components/order/track-view";
import { utilityMetadata } from "@/lib/meta";

export const metadata: Metadata = utilityMetadata({
  title: "Track Your Order",
  description:
    "Enter your order number and phone number to see live shipping status, courier tracking and your invoice.",
  path: "/track",
});

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ number?: string }>;
}) {
  const { number } = await searchParams;
  return <TrackView initialNumber={number ?? ""} />;
}
