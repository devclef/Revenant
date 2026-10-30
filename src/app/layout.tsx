import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Revenant",
  description: "Your past self returns with the receipts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
