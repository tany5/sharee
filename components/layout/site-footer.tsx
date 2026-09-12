import Link from "next/link";
import Image from "next/image";
import { Mail, Phone, MapPin } from "lucide-react";
import { FacebookIcon, InstagramIcon } from "@/components/icons/brand";
import { SITE } from "@/lib/site";
import { CATEGORIES } from "@/lib/data/catalog";

const HELP_LINKS = [
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Return Policy", href: "/return-policy" },
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
  { label: "Track / Order Help", href: "/account" },
];

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-[#431d0b] text-[#f0e2cd]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              aria-label={`${SITE.name} — ${SITE.tagline}`}
              className="flex w-fit items-center"
            >
              <Image
                src="/logo/logo-light.webp"
                alt={`${SITE.name} — ${SITE.tagline}`}
                width={480}
                height={216}
                className="h-auto w-[172px] object-contain"
              />
            </Link>
            <p className="max-w-xs text-sm leading-6 text-[#e2c9a6]/90">
              {SITE.promise} Quality assured weaves, easy returns and fast
              delivery across India.
            </p>
            <div className="flex gap-2">
              {[
                { Icon: InstagramIcon, label: "Instagram", href: SITE.instagramUrl },
                { Icon: FacebookIcon, label: "Facebook", href: SITE.facebookUrl },
              ].map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE.name} on ${label}`}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-[#7a4f2a] text-[#e2c9a6] transition-colors hover:border-[#c9a27a] hover:text-[#f6ebd9]"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#c9a27a]">
              Shop
            </h3>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/sarees" className="transition-colors hover:text-[#f6ebd9]">
                  All Sarees (₹199)
                </Link>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="transition-colors hover:text-[#f6ebd9]"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Help */}
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#c9a27a]">
              Help
            </h3>
            <ul className="space-y-2.5 text-sm">
              {HELP_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="transition-colors hover:text-[#f6ebd9]">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/about" className="transition-colors hover:text-[#f6ebd9]">
                  About Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.24em] text-[#c9a27a]">
              Get in touch
            </h3>
            <ul className="space-y-3 text-sm text-[#e2c9a6]/90">
              <li className="flex items-start gap-2.5">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#c9a27a]" />
                {SITE.address}
              </li>
              <li>
                <a
                  href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-[#f6ebd9]"
                >
                  <Phone size={16} className="shrink-0 text-[#c9a27a]" />
                  {SITE.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${SITE.email}`}
                  className="flex items-center gap-2.5 transition-colors hover:text-[#f6ebd9]"
                >
                  <Mail size={16} className="shrink-0 text-[#c9a27a]" />
                  {SITE.email}
                </a>
              </li>
            </ul>
            <p className="mt-5 text-[13px] leading-6 text-[#c9a27a]">
              7 days easy returns · Cash on Delivery · Free shipping above ₹999
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-[#7a4f2a]/60 pt-6 text-xs text-[#c9a27a] sm:flex-row">
          <p>© {new Date().getFullYear()} {SITE.legalName}. All rights reserved.</p>
          <p className="flex items-center gap-1.5">
            We accept: UPI · Visa · Mastercard · RuPay · Net Banking · COD
          </p>
        </div>
      </div>
    </footer>
  );
}
