import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How TheTanti protects your privacy, order information, payment data and customer rights.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      kicker="Your privacy"
      title="Privacy Policy"
      lede="At TheTanti, protecting your privacy and secure personal data is our primary commitment. We collect only the baseline essential information required to accurately process and deliver your orders."
    >
      <div className="space-y-6">
        <PolicySection title="1. Information We Collect">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Delivery Credentials:</strong> Your name, shipping address,
              contact phone number, and email address are captured at checkout
              solely to package and ship your items.
            </li>
            <li>
              <strong>Session Data:</strong> Items added to your cart or wishlist
              are stored locally inside your personal browser ecosystem to
              maintain basket integrity during your visit.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="2. Information Sharing & Third Parties">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Payment Processing:</strong> Your financial information
              (UPI handles, cards, net banking details) is passed directly to our
              encrypted payment gateway partner, such as Razorpay. TheTanti never
              sees, processes, or stores your raw card credentials or banking
              passwords.
            </li>
            <li>
              <strong>Logistics Partners:</strong> Your address and phone numbers
              are shared securely with verified domestic courier networks to
              facilitate accurate delivery.
            </li>
            <li>
              <strong>No Commercial Sale:</strong> We strictly never rent, sell,
              or trade your personal data to external marketing companies.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="3. Cookies and Analytics">
          <p>
            Our platform utilizes industry-standard tracking elements, such as
            Google Analytics, Microsoft Clarity, and Meta Pixels, to evaluate
            general advertisement metrics and see which regional saree styles
            perform best. These tools may measure visits, purchases, clicks,
            scroll depth, heatmaps, and session recordings, but they never
            access your private data files.
          </p>
        </PolicySection>

        <PolicySection title="4. Your Rights">
          <p>
            You hold full authority to request the complete modification, export,
            or total deletion of your personal account record database at any
            time by contacting us directly at {SITE.email}.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
