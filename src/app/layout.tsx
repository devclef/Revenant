import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted fonts loaded via next/font/local: a build-time local import that
// bundles the woff2 files and serves them from the app's own origin. It emits a
// <style> tag (allowed by style-src 'unsafe-inline') and font files from 'self'
// (allowed by font-src 'self'); it makes no remote font request, so the strict
// CSP is satisfied. Both faces are variable fonts covering their full weight
// range from a single file. See src/app/fonts/NOTE.md.
const serif = localFont({
  src: "./fonts/EBGaramond-Variable.woff2",
  variable: "--font-serif",
  weight: "400 800",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Revenant",
  description: "Your past self returns with the receipts.",
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
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
