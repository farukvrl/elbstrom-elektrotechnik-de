import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Root Layout — Next.js App Router
 *
 * Demonstrates:
 *  - Full metadata setup (OpenGraph, Twitter Cards, robots, canonical, icons, manifest)
 *  - next/font — zero-CLS, self-hosted Google Fonts
 *  - JSON-LD structured data (Schema.org LocalBusiness) injected into <head>
 */

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default:  "Your Business – Tagline",
    template: "%s | Your Business",
  },

  description:
    "A short, keyword-rich description of your business for search engines (≤ 160 chars).",

  keywords: [
    "primary keyword",
    "secondary keyword",
    "location keyword",
  ],

  authors:   [{ name: "Your Business" }],
  creator:   "Your Business",
  publisher: "Your Business",

  alternates: { canonical: "/" },

  openGraph: {
    type:        "website",
    locale:      "en_US",
    url:         siteUrl,
    siteName:    "Your Business",
    title:       "Your Business – Tagline",
    description: "Short OG description shown when shared on social media.",
    images: [
      {
        url:    "/img/og-image.jpg",
        width:  1200,
        height: 630,
        alt:    "Your Business",
      },
    ],
  },

  twitter: {
    card:        "summary_large_image",
    title:       "Your Business – Tagline",
    description: "Short Twitter card description.",
    images:      ["/img/og-image.jpg"],
  },

  robots: {
    index:  true,
    follow: true,
    googleBot: {
      index:               true,
      follow:              true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet":       -1,
    },
  },

  icons: {
    icon: [
      { url: "/favicon.ico",        sizes: "any" },
      { url: "/favicon-96x96.png",  sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg",        type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },

  manifest: "/site.webmanifest",
};

// ── JSON-LD structured data ───────────────────────────────────────────────────
function buildJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type":    "LocalBusiness",           // swap for "Electrician", "Restaurant", etc.
    name:       "Your Business",
    url:        siteUrl,
    logo:       `${siteUrl}/img/logo.png`,
    telephone:  "+1 000 000 0000",
    email:      "hello@example.com",
    address: {
      "@type":           "PostalAddress",
      streetAddress:     "123 Main Street",
      addressLocality:   "City",
      addressRegion:     "State",
      postalCode:        "00000",
      addressCountry:    "US",
    },
    geo: {
      "@type":    "GeoCoordinates",
      latitude:   0.0000,
      longitude:  0.0000,
    },
    openingHoursSpecification: [
      {
        "@type":     "OpeningHoursSpecification",
        dayOfWeek:   ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens:       "08:00",
        closes:      "17:00",
      },
    ],
    priceRange: "$$",
  };
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {/* Inject JSON-LD into <head> via dangerouslySetInnerHTML */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildJsonLd()) }}
        />
        <main>{children}</main>
      </body>
    </html>
  );
}
