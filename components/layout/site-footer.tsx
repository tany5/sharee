import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Phone } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/brand";
import { LotusIcon } from "@/components/icons/lotus";
import { NewsletterForm } from "@/components/layout/newsletter-form";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/data/catalog";

/**
 * The footer sits on deep espresso in both themes (deliberate hardcoded
 * values — it is the one surface that does not follow the theme switch).
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
    <h3 className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d6ad72]">
      {children}
    </h3>
  );
}

export function SiteFooter() {
  const link = "text-sm text-[#c8b9aa] transition-colors hover:text-[#f7f1e8]";

  return (
    <footer className="mt-4 bg-footer text-[#f7f1e8]">
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
            <p className="mt-4 font-display text-lg text-[#f7f1e8]">
              {SITE.motto}
            </p>
            <p className="mt-2 max-w-xs text-sm leading-6 text-[#9e8f83]">
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
                  className="flex h-9 w-9 items-center justify-center rounded-pill border border-white/15 text-[#c8b9aa] transition-colors hover:border-accent hover:text-accent-light"
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
            <div className="rounded-panel border border-white/12 bg-white/[0.04] p-5">
              <h3 className="font-display text-lg text-[#f7f1e8]">
                Join Our Journey
              </h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[#9e8f83]">
                Get updates on new arrivals and more.
              </p>
              <div className="mt-4">
                <NewsletterForm />
              </div>
            </div>

            <ul className="mt-6 space-y-3 text-sm text-[#c8b9aa]">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-accent" />
                <span className="text-[13px] leading-5">{SITE.address}</span>
              </li>
              <li>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2.5 text-[13px] transition-colors hover:text-[#f7f1e8]"
                >
                  <Phone size={16} className="shrink-0 text-accent" />
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="flex items-center gap-2.5 text-[13px] transition-colors hover:text-[#f7f1e8]"
                >
                  <Mail size={16} className="shrink-0 text-accent" />
                  {SITE.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-white/10 pt-6 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2.5 text-xs text-[#9e8f83]">
            <LotusIcon size={16} className="text-accent/60" />©{" "}
            {new Date().getFullYear()} {SITE.legalName}. All rights reserved.
          </p>
          <p className="text-xs text-[#9e8f83]">
            UPI · Visa · Mastercard · RuPay · Net Banking · Cash on Delivery
          </p>
        </div>
      </div>
    </footer>
  );
}
