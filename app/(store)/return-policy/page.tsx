import { PageShell, PolicySection } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Return & Refund Policy",
  description:
    "7-day hassle-free returns on every saree. If you’re not happy with your ₹199 saree, we’ll refund you or swap the size/style — no questions asked.",
  path: "/return-policy",
});

export default function ReturnPolicyPage() {
  return (
    <PageShell
      kicker="Good to know"
      title="Returns & Refunds"
      lede="If a saree isn’t right, it comes back — simply and free. You shop at ₹199 with zero risk."
    >
      <div className="space-y-6">
        <PolicySection title="7-day easy returns">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              You have <strong>7 days from delivery</strong> to request a return
              or exchange.
            </li>
            <li>Return pickup is free across India for eligible pincodes.</li>
            <li>
              Items must be unworn, unwashed, with the blouse piece and any
              tags attached.
            </li>
            <li>
              Small print/colour differences between photos and fabric are
              normal for textiles and are not grounds for return — we quality
              check colours before every dispatch.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="How to start a return">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Message us on WhatsApp at {SITE.phone} (or email{" "}
              {SITE.email}) with your order number.
            </li>
            <li>We’ll schedule a free pickup from your delivery address.</li>
            <li>
              Once the saree reaches us and passes a quick check, your refund
              or exchange is processed within 3–5 working days.
            </li>
          </ol>
        </PolicySection>

        <PolicySection title="Refunds">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Paid orders: refunded to the original payment method within 3–5
              working days of quality check.
            </li>
            <li>
              COD orders: refunded via UPI/bank transfer once we confirm your
              details.
            </li>
            <li>
              Exchanges ship free of charge; if the replacement costs more than
              ₹199 (multi-piece orders), the difference is confirmed with you
              first.
            </li>
          </ul>
        </PolicySection>

        <PolicySection title="Damaged or incorrect items">
          <p>
            In the unlikely event your saree arrives damaged or is not what you
            ordered, message us within 48 hours of delivery with a photo. We’ll
            arrange a free replacement or a full refund — your choice.
          </p>
        </PolicySection>
      </div>
    </PageShell>
  );
}
