import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Shipping Policy",
  description:
    "TheTanti shipping and delivery timelines, charges, COD support and tracking information.",
  path: "/shipping-policy",
});

export default function ShippingPolicyPage() {
  return (
    <PageShell
      kicker="Delivery support"
      title="Shipping and Delivery Policy"
      lede="Thank you for choosing TheTanti. We strive to provide premium Indian textile weaves with fast, reliable, and trackable delivery directly to your doorstep."
    >
      <div className="space-y-6">
        <PolicySection title="1. Processing Timelines">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              All orders placed prior to 1:00 PM IST on standard working days
              (Monday through Saturday) are typically dispatched from our Howrah
              fulfillment hub on the same day.
            </li>
            <li>
              Orders placed during national holidays, regional festivals, or
              Sundays will be processed on the following immediate business
              working day.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="2. Delivery Timelines">
          <ul className="list-disc space-y-2 pl-5">
            <li><strong>Standard National Delivery:</strong> 3 to 5 working days across India.</li>
            <li><strong>Metro City Shipments:</strong> 2 to 4 business days in primary metropolitan zones.</li>
          </ul>
        </PolicySection>

        <PolicySection title="3. Shipping Charges">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              All single or combined cart orders valued at ₹999 and above qualify
              for <strong>Free Shipping</strong> across India.
            </li>
            <li>
              Flat shipping of ₹{SITE.shippingFee} is strictly applied to all
              individual or multi-piece orders totaling under ₹999.
            </li>
            <li>
              Cash on Delivery (COD) services are available for valid regional
              pincodes at no incremental processing fee.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="4. Tracking Support">
          <p>
            Once your product leaves our warehouse facility, an automated
            shipment status link containing live courier tracking digits will be
            routed to your registered WhatsApp or SMS contact channel.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
