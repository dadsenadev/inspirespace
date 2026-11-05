import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function CreatorStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#0F172A]">
      <header className="border-b border-[#E2E8F0] bg-[#FAFAFA]">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                INSPIRESPACE
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-sm font-medium">Creator Studio</span>
            </div>
            <nav className="flex items-center gap-5 text-xs font-medium text-slate-600">
              <Link
                href="/studio"
                className="hover:text-[#0F172A] transition-colors"
              >
                Overview
              </Link>
              <Link
                href="/onboarding"
                className="hover:text-[#0F172A] transition-colors"
              >
                KYB/KYC Onboarding
              </Link>
              <Link
                href="/campaigns/new"
                className="hover:text-[#0F172A] transition-colors"
              >
                + New Campaign Builder
              </Link>
              <Link
                href="/campaigns/cmp_vayu_01/edit"
                className="hover:text-[#0F172A] transition-colors"
              >
                Edit Campaign
              </Link>
            </nav>
          </div>
          <TrustBadge variant="slate">Intermediary KYB Enforced</TrustBadge>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
