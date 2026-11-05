import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function BackerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-[#FAFAFA]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              INSPIRESPACE
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-medium">Backer Escrow Portal</span>
          </div>
          <TrustBadge variant="emerald">Escrow Protected Backer</TrustBadge>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

