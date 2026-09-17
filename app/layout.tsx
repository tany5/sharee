import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

/** Editorial headings — campaign statements, section titles, hero. */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

/** Everything else — navigation, buttons, prices, product names, metadata. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: `${SITE.motto} ${SITE.promise} Shop cotton, silk, printed and designer sarees — one simple price, quality checked, easy returns, delivery across India.`,
  keywords: [
    "sarees",
    "saree online",
    "sarees under 199",
    "cotton sarees",
    "silk sarees",
    "designer sarees",
    "Indian traditional wear",
  ],
  openGraph: {
    type: "website",
    siteName: SITE.name,
    locale: "en_IN",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "TheTanti — Sarees for Everyday Life. All sarees ₹199 flat.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.jpg"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#e2448f",
};;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
