import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { Footer } from "@/components/ui/Footer";
import { HOME_DESCRIPTION } from "@/lib/page-metadata";

// Self-hosted fonts loaded via next/font/local: a build-time local import that
// bundles the woff2 files and serves them from the app's own origin. It emits a
// <style> tag (allowed by style-src 'unsafe-inline') and font files from 'self'
// (allowed by font-src 'self'); it makes no remote font request, so the strict
// CSP is satisfied. Both faces are variable fonts covering their full weight
// range from a single file. See src/app/fonts/NOTE.md.
const ebGaramond = localFont({
  src: "./fonts/EBGaramond-Variable.woff2",
  variable: "--font-serif",
  weight: "400 800",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const inter = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const FALLBACK_ORIGIN = "http://localhost:3000";

/**
 * Site-wide metadata. Runs per request so APP_ORIGIN is read from the
 * environment at runtime, not frozen at build time. Pages set their own title
 * through the template; metadataBase makes relative Open Graph URLs absolute.
 */
export async function generateMetadata(): Promise<Metadata> {
  const origin = (process.env.APP_ORIGIN ?? "").trim().replace(/\/+$/, "");
  return {
    metadataBase: new URL(origin || FALLBACK_ORIGIN),
    title: {
      default: "Revenant",
      template: "%s · Revenant",
    },
    description: HOME_DESCRIPTION,
    icons: {
      icon: "/icon.svg",
      apple: "/apple-icon",
    },
  };
}

/**
 * Viewport settings. `interactiveWidget: "resizes-content"` makes the on-screen
 * keyboard shrink the layout viewport instead of covering the page, so a focused
 * field stays in view on small phones.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the per-request nonce the middleware set opts this layout into
  // dynamic rendering. That is what makes Next.js inject the matching nonce
  // onto every inline bootstrap script it emits, so the strict
  // `script-src 'self' 'nonce-...'` CSP permits them instead of blocking them.
  // Statically prerendered pages bake un-nonced inline scripts at build time,
  // which the browser's CSP then refuses; dynamic rendering avoids that.
  await headers();

  return (
    <html lang="en" className={`${ebGaramond.variable} ${inter.variable}`}>
      <body>
        {children}
        {/* Layout-owned wrapper: keeps the footer in normal flow, below the page
            content in stacking order, with a spacer so Stage content that
            overflows the scene at 360x640 cannot end under the footer (issue #199).
            See `.site-footer` in globals.css. */}
        <div className="site-footer">
          <Footer />
        </div>
      </body>
    </html>
  );
}
