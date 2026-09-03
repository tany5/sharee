import { Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { PageShell } from "@/components/pages/page-shell";
import { SITE } from "@/lib/site";
import { pageMetadata } from "@/lib/meta";

export const metadata = pageMetadata({
  title: "Contact Us",
  description:
    "Questions about an order, size, fabric or returns? Reach Ambika on WhatsApp, phone or email — we reply within a few hours on working days.",
  path: "/contact",
});

const CARDS = [
  {
    Icon: MessageCircle,
    t: "WhatsApp",
    v: SITE.phone,
    hint: "Fastest — reply within minutes",
    href: `https://wa.me/919876543210`,
  },
  {
    Icon: Phone,
    t: "Call us",
    v: "Mon–Sat · 10am–7pm IST",
    hint: SITE.phone,
    href: `tel:${SITE.phone.replace(/\s/g, "")}`,
  },
  {
    Icon: Mail,
    t: "Email",
    v: SITE.email,
    hint: "Replies within 24 hours",
    href: `mailto:${SITE.email}`,
  },
  {
    Icon: MapPin,
    t: "Visit",
    v: "Jaipur, Rajasthan",
    hint: "Our fulfilment hub",
  },
];

export default function ContactPage() {
  return (
    <PageShell
      kicker="We're here to help"
      title="Contact Ambika"
      lede="Order query, exchange, or just saree advice? Write, call or WhatsApp — a real human replies, usually within a few hours."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map(({ Icon, t, v, hint, href }) => {
          const inner = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/15 text-accent">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <h2 className="mt-3 font-display text-lg font-bold text-ink">{t}</h2>
              <p className="text-sm font-semibold text-ink">{v}</p>
              <p className="text-xs text-muted">{hint}</p>
            </>
          );
          const classes =
            "flex h-full flex-col rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/60";
          return href ? (
            <a key={t} href={href} className={classes}>
              {inner}
            </a>
          ) : (
            <div key={t} className={classes}>
              {inner}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-xl font-bold text-ink">
          Track your order
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink2">
          Orders placed from this device appear under{" "}
          <a href="/account" className="font-semibold text-accent underline">
            My Account → My Orders
          </a>
          , with estimated delivery dates and full details.
        </p>
      </div>
    </PageShell>
  );
}
