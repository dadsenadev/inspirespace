import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FFFFFF] text-[#0F172A]">
      <header className="sticky top-0 z-30 border-b border-[#E2E8F0] bg-[#FFFFFF]/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-semibold tracking-tight text-[#0F172A]"
            >
              INSPIRESPACE
            </Link>
            <TrustBadge variant="emerald">
              100% Milestone-Escrowed · GST Compliant
            </TrustBadge>
          </div>
          <nav className="flex items-center gap-6 text-sm font-medium text-[#0F172A]">
            <Link href="/pledges" className="hover:underline">
              Backer Dashboard
            </Link>
            <Link href="/studio" className="hover:underline">
              Creator Studio
            </Link>
            <Link href="/compliance" className="hover:underline">
              Admin &amp; Ledger
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-[#E2E8F0] bg-[#FAFAFA] py-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 px-6 text-xs text-slate-600 sm:flex-row">
          <p>
            Operated in India under OPC Pvt Ltd Intermediary Structure ·
            Double-Entry Paise Ledger · 30% / 40% / 30% Escrow Tranches
          </p>
          <p className="font-mono">SAC 998599 · 5% Commission + 18% GST</p>
        </div>
      </footer>
    </div>
  );
}

