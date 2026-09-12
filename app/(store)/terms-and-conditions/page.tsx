import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Terms and Conditions",
  description:
    "TheTanti terms covering website use, saree purchases, product information, pricing, payment security and governing law.",
  path: "/terms-and-conditions",
});

export default function TermsAndConditionsPage() {
  return (
    <PageShell
      kicker="Store terms"
      title="Terms and Conditions"
      lede={`Welcome to TheTanti (${SITE.url}). These Terms and Conditions govern your use of our website and the purchase of any goods from our platform.`}
    >
      <div className="space-y-6">
        <PolicySection title="1. Business Ownership">
          <p>
            The website {SITE.url} and the brand name "{SITE.name}" are operated
            as an independent Sole Proprietorship under Indian jurisdiction. All
            commercial invoices, billing, and payment processing queries are
            managed under our registered enterprise entity.
          </p>
          <p className="mt-3">
            Registered office: {SITE.address}. Customer support and grievance
            queries can be sent to {SITE.email} or raised by calling {SITE.phone}.
          </p>
        </PolicySection>

        <PolicySection title="2. Product Information and Pricing">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              All sarees hosted on our platform are priced uniformly at ₹{SITE.price}
              unless a multi-piece bundle or bulk package specifies otherwise.
            </li>
            <li>
              We strive for absolute color accuracy; however, minor differences
              between studio photography and physical textiles are typical due to
              digital display variants and natural weave characteristics.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="3. Order Processing & Transaction Security">
          <ul className="list-disc space-y-2 pl-5">
            <li>By placing an order, you agree that all details provided are accurate.</li>
            <li>
              Payment processing is handled securely via authorized RBI-compliant
              Payment Aggregators, such as Razorpay. We do not collect or store
              full credit/debit card numbers or UPI PIN parameters on our local
              servers.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="4. Cancellation">
          <p>
            Orders can be cancelled before dispatch by contacting {SITE.email} or
            {SITE.phone} with the order ID. Once dispatched, the order will be
            handled under our Return and Refund Policy.
          </p>
        </PolicySection>

        <PolicySection title="5. Governing Law">
          <p>
            These terms are governed by and construed in accordance with the laws
            of India. Any disputes arising out of transactions on this website
            shall be subject to the exclusive jurisdiction of the courts in
            Howrah, West Bengal.
          </p>
        </PolicySection>

        <PolicySection title="6. Modifications">
          <p>
            We reserve the right to revise these Terms and Conditions at any
            time. Any changes will be published immediately on this page.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
