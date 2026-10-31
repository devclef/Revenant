import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
