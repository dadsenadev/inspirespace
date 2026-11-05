import Link from "next/link";
import { VerificationStatusBanner } from "@/components/creator/verification-status-banner";
import { SEED_CAMPAIGNS } from "@/lib/campaigns/catalog";
import { formatPaiseToINR } from "@/lib/finance/calculator";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function CreatorStudioPage() {
  return (
    <div className="space-y-8">
      {/* Creator Verification Status Banner that locks campaign publishing until kyc_status === 'APPROVED' */}
      <VerificationStatusBanner showPublishGateAction={true} />

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
            Creator Studio — KYC, Campaigns &amp; 30/40/30 Escrow Tranches
          </h1>
          <p className="text-sm text-slate-600">
            Manage entity KYC (PAN, GSTIN, CIN, IFSC), reward tiers, and upload
            BOM / tooling / shipping proofs for milestone tranche releases.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/onboarding"
            className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-[#FAFAFA] px-3.5 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-100 transition-colors"
          >
            KYB/KYC Onboarding →
          </Link>
          <Link
            href="/campaigns/new"
            className="inline-flex items-center rounded-md bg-[#0F172A] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800 transition-colors"
          >
            + Launch New Campaign Builder
          </Link>
        </div>
      </div>

      {/* Creator Campaigns Table */}
      <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#0F172A]">
          Your Campaigns &amp; Storefront Links
        </h2>
        <div className="divide-y divide-[#E2E8F0]">
          {SEED_CAMPAIGNS.map((cmp) => (
            <div
              key={cmp.id}
              className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">
                    {cmp.category}
                  </span>
                  <TrustBadge variant="emerald">{cmp.status}</TrustBadge>
                </div>
                <p className="text-sm font-semibold text-[#0F172A]">
                  {cmp.title}
                </p>
                <p className="font-mono text-xs text-slate-500">
                  Goal: {formatPaiseToINR(cmp.goalAmountPaise)} · Pledged:{" "}
                  {formatPaiseToINR(cmp.pledgedAmountPaise)} ({cmp.backerCount}{" "}
                  backers)
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  href={`/campaigns/${cmp.id}/edit`}
                  className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-slate-100"
                >
                  Edit Campaign &amp; Tiers
                </Link>
                <Link
                  href={`/projects/${cmp.slug}`}
                  className="rounded-md border border-[#0F172A] bg-[#FFFFFF] px-3 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#FAFAFA]"
                >
                  View Storefront ↗
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
