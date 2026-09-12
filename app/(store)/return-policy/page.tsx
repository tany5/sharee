import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Return & Refund Policy",
  description:
    "TheTanti return and refund policy, including the 7-day return window, item condition rules, refund timelines and damaged shipment support.",
  path: "/return-policy",
});

export default function ReturnPolicyPage() {
  return (
    <PageShell
      kicker="Easy support"
      title="Return and Refund Policy"
      lede="We want you to shop with absolute confidence. If a saree does not meet your expectations, our zero-risk return protocol handles everything easily and transparently."
    >
      <div className="space-y-6">
        <PolicySection title="1. The 7-Day Return Window">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Customers maintain a strict window of <strong>7 days from the
              physical delivery date</strong> to formally request a product
              return or standard item exchange.
            </li>
            <li>
              Return reverse logistics pick-ups are entirely free across all
              supported domestic pincodes in India.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="2. Item Integrity Conditions">
          <p>
            To pass our quality framework verification, all returned sarees must
            remain completely unworn, unwashed, and free of physical damage, with
            the original blouse piece and any accompanying price tags securely
            attached.
          </p>
        </PolicySection>

        <PolicySection title="3. Step-by-Step Return Process">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Initiate your query by messaging our support line on WhatsApp at
              {` ${SITE.phone} `}or via email at {SITE.email} with your unique
              Order ID.
            </li>
            <li>Our team schedules a free physical reverse-pickup from your native delivery address.</li>
            <li>
              Once the package returns to our hub and passes a foundational
              structural check, your financial refund is executed within 3 to 5
              working days.
            </li>
          </ol>
        </PolicySection>

        <PolicySection title="4. Refund Methods & Timelines">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Prepaid Transactions:</strong> Refunds are credited right
              back to the original source payment instrument (bank account,
              credit card, or UPI wallet) within 3-5 working days
              post-inspection.
            </li>
            <li>
              <strong>Cash on Delivery (COD):</strong> COD funds are transferred
              digitally directly to your validated UPI handle or personal bank
              account once account details are confirmed with our support
              representatives.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="5. Damaged or Faulty Shipments">
          <p>
            In the rare event that an item lands in a defective state, please
            capture a smartphone image and alert our team within 48 hours of box
            unsealing. We will issue an express free replacement or complete
            money refund based entirely on your preference.
          </p>
        </PolicySection>

        <PolicySection title="6. Cancellation Before Dispatch">
          <p>
            If you need to cancel an order before it is dispatched, contact
            {` ${SITE.email} `}or {SITE.phone} with your Order ID. Prepaid
            refunds for successfully cancelled orders are returned to the
            original payment method within 3-5 working days.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
