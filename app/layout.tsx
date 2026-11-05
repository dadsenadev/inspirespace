import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspirespace | Curated Escrow Crowdfunding & Pre-Order Launchpad (India)",
  description:
    "Bank-grade, milestone-escrowed crowdfunding and pre-order launchpad for Indian D2C Hardware & IoT, Tabletop & Indie Games, and Artisanal Consumer Batch Launches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-[#FFFFFF] text-[#0F172A]">
      <body className="min-h-screen bg-[#FFFFFF] text-[#0F172A] antialiased selection:bg-[#0F172A] selection:text-[#FFFFFF]">
        {children}
      </body>
    </html>
  );
}

