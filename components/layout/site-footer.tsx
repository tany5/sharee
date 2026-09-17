import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/brand";
import { LotusIcon } from "@/components/icons/lotus";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/data/catalog";

/**
 * The footer sits on deep raspberry in the single bright theme (deliberate
 * hardcoded values — the one deep surface anchors the bright page).
 */
const HELP_LINKS = [
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return Policy", href: "/return-policy" },
  { label: "Track / Order Help", href: "/account" },
];

const ABOUT_LINKS = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3b8d4]">
      {children}
    </h3>
  );
}

export function SiteFooter() {
  const link = "text-sm text-[#f5d3e3] transition-colors hover:text-white";

  return (
    <footer className="mt-4 bg-[#4a0d2e] text-white">
      <div className="tt-container py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          {/* Brand */}
          <div className="lg:col-span-3">
            <Link
              href="/"
              aria-label={`${SITE.name} — ${SITE.motto}`}
              className="flex w-fit items-center"
            >
              <Image
                src="/logo/logo-light.webp"
                alt={`${SITE.name} — ${SITE.motto}`}
                width={480}
                height={216}
                className="h-auto w-[140px] object-contain"
              />
            </Link>
            <p className="mt-4 font-display text-lg text-white">
              {SITE.motto}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[#f5d3e3]/85">
              {SITE.promise} Made for everyday moments, for women like you.
            </p>
            <div className="mt-5 flex gap-2">
              {[
                {
                  Icon: InstagramIcon,
                  label: "Instagram",
                  href: SITE.instagramUrl,
                },
                {
                  Icon: FacebookIcon,
                  label: "Facebook",
                  href: SITE.facebookUrl,
                },
              ].map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE.name} on ${label}`}
                  className="flex h-9 w-9 items-center justify-center rounded-pill border border-white/20 text-[#f5d3e3] transition-colors hover:border-white hover:bg-white/10 hover:text-white"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div className="lg:col-span-2">
            <ColumnHeading>Shop</ColumnHeading>
            <ul className="space-y-2.5">
              <li>
                <Link href="/sarees" className={link}>
                  All Sarees (₹199)
                </Link>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link href={`/categories/${c.slug}`} className={link}>
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div className="lg:col-span-2">
            <ColumnHeading>Help</ColumnHeading>
            <ul className="space-y-2.5">
              {HELP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About */}
          <div className="lg:col-span-2">
            <ColumnHeading>About</ColumnHeading>
            <ul className="space-y-2.5">
              {ABOUT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className={link}>
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Newsletter + contact */}
          <div className="lg:col-span-3">
            <div className="rounded-panel border border-white/15 bg-white/[0.06] p-5">
              <h3 className="font-display text-lg text-white">
                Join Our Journey
              </h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[#f5d3e3]/85">
                Get updates on new arrivals and more.
              </p>
              <div className="mt-4">
                <NewsletterForm />
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-sm text-[#f5d3e3]">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
                <span className="text-[13px] leading-5">{SITE.address}</span>
              </li>
              <li>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2.5 text-[13px] transition-colors hover:text-white"
                >
                  <Phone size={16} className="shrink-0 text-accent" />
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="flex items-center gap-2.5 text-[13px] transition-colors hover:text-white"
                >
                  <Mail size={16} className="shrink-0 text-accent" />
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2.5 text-xs text-[#f5d3e3]/70">
            <LotusIcon size={16} className="text-accent2/80" />©{" "}
            {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
          </p>
          <p className="text-xs text-[#f5d3e3]/70">
            UPI · Visa · Mastercard · RuPay · Net Banking · Cash on Delivery
          </p>
        </div>
      </div>
    </footer>
  );
}
