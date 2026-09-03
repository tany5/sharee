import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Shipping Policy",
  description:
    "Free shipping on saree orders above ₹999, flat ₹49 below. We deliver across India in 3–5 working days from our Jaipur fulfilment hub.",
  path: "/shipping-policy",
});

export default function ShippingPolicyPage() {
  return (
    <PageShell
      kicker="Good to know"
      title="Shipping Policy"
      lede="Fast, trackable delivery across India — every order packed with care from our Jaipur hub."
    >
      <div className="space-y-6">
        <PolicySection title="Delivery time & charges">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Orders of ₹999 and above ship <strong>free</strong> — every other
              order ships for a flat ₹{SITE.shippingFee}.
            </li>
            <li>Standard delivery: 3–5 working days across India.</li>
            <li>Metro cities usually receive orders in 2–4 days.</li>
            <li>
              Cash on Delivery is available on eligible pincodes with no extra
              fee.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Order processing">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Orders placed before 1 pm IST on working days are usually shipped
              the same day.
            </li>
            <li>
              You’ll receive a WhatsApp/SMS update with tracking once your
              saree leaves our hub.
            </li>
            <li>
              If an item is unexpectedly out of stock, we’ll reach out within
              24 hours to confirm a replacement or full refund.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Track your order">
          <p>
            Orders placed from your device appear under{" "}
            <a href="/account" className="font-semibold text-accent underline">
              My Account → My Orders
            </a>{" "}
            with status and the estimated delivery date. For anything else,
            message us on WhatsApp at {SITE.phone} — quote your order number
            (e.g. AMB-260903-1234) and we’ll take it from there.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
