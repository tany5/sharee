import type { Metadata, Viewport } from "next";
import { Judson, Teachers } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

const judson = Judson({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-judson",
  display: "swap",
});

const teachers = Teachers({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-teachers",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description:
    `${SITE.tagline}. ${SITE.promise} Shop cotton, silk, printed and designer sarees — quality assured, easy returns, fast delivery across India.`,
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
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6ebe1" },
    { media: "(prefers-color-scheme: dark)", color: "#221003" },
  ],
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("ambika-theme");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${judson.variable} ${teachers.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
