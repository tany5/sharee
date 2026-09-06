import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How TheTanti handles your data: we collect only what’s needed to deliver sarees, we never sell your information, and you can ask us to delete it any time.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <PageShell
      kicker="Your data, protected"
      title="Privacy Policy"
      lede="We collect the minimum needed to deliver your order — and nothing else. Here’s exactly what that means."
    >
      <div className="space-y-6">
        <PolicySection title="What we collect & why">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Delivery details</strong> (name, phone, address) — used
              only to fulfil and deliver your order.
            </li>
            <li>
              <strong>Cart & wishlist</strong> — stored locally in your own
              browser so your basket follows you around the store.
            </li>
            <li>
              <strong>Payment information</strong> — processed by our payment
              partners (e.g. Razorpay/UPI apps). We never see or store full card
              or UPI credentials.
            </li>
            <li>
              <strong>Anonymous analytics</strong> (page views, ad attribution)
              — helps us understand which sarees people love and measure our
              ads honestly.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="What we never do">
          <ul className="list-disc space-y-2 pl-5">
            <li>We never sell or rent your personal information.</li>
            <li>
              We never send unsolicited marketing — you’ll only hear from us
              about your orders.
            </li>
            <li>
              We never store payment card numbers or UPI credentials on our
              servers.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Cookies & advertising">
          <p>
            This store uses a Meta Pixel and Google Analytics (when configured)
            to measure ad performance — the same tools virtually every online
            store uses. If you’ve arrived from a Facebook or Instagram ad, the
            link carries campaign information that helps us understand which
            ads work; it never reveals your identity to us beyond what you
            voluntarily share at checkout.
          </p>
        </PolicySection>

        <PolicySection title="Your rights">
          <p>
            You can ask us to export or delete your data at any time by writing
            to {SITE.email}. Order records are kept only as long as needed for
            accounting, returns and customer support.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
