import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  ALLOWED_VERTICALS,
  SEED_CAMPAIGNS,
  computeCampaignProgressMetrics,
} from "@/lib/campaigns/catalog";
import {
  calculateEscrowTrancheSchedule,
  formatPaiseToINR,
} from "@/lib/finance/calculator";

export default function PublicHomePage() {
  const sampleSchedule = calculateEscrowTrancheSchedule(150_000_000n, {
    tdsTcsRateBps: 0n,
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 space-y-14">
      {/* Hero Section */}
      <section className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-8 md:p-10">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="max-w-3xl space-y-4">
            <TrustBadge variant="emerald">
              All-or-Nothing Escrow · Verified Indian KYC (PAN / GSTIN / CIN)
            </TrustBadge>
            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Industrial-Grade Pre-Order &amp; Reward Launchpad for India.
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              Every rupee pledged is held in nodal escrow until the campaign
              hits 100% of its funding goal, and disbursed to creators strictly
              in{" "}
              <strong className="font-medium text-[#0F172A]">
                30% / 40% / 30% milestone-verified tranches
              </strong>
              .
            </p>
          </div>
          <div className="flex flex-col gap-3 shrink-0">
            <Link
              href="/campaigns/new"
              className="inline-flex items-center justify-center rounded-md bg-[#0F172A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800 transition-colors"
            >
              Launch a Project in Creator Studio →
            </Link>
            <Link
              href="/projects/vayu-1-open-source-air-quality-telemetry"
              className="inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-5 py-2.5 text-xs font-semibold text-[#0F172A] hover:bg-slate-50 transition-colors"
            >
              Explore Featured Hardware Campaign
            </Link>
          </div>
        </div>
      </section>

      {/* Curated Live Storefront Discovery */}
      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">
              Live Escrow-Verified Campaigns
            </h2>
            <p className="text-xs text-slate-500">
              Each project below has passed NSDL PAN/GSTIN KYB and DVT/PVT
              prototype verification.
            </p>
          </div>
          <span className="font-mono text-xs text-[#16A34A]">
            100% NODAL ESCROW PROTECTED
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {SEED_CAMPAIGNS.map((campaign) => {
            const { percentFunded, daysLeft } =
              computeCampaignProgressMetrics(campaign);
            const barWidth = Math.min(100, Math.max(0, percentFunded));

            return (
              <Link
                key={campaign.id}
                href={`/projects/${campaign.slug}`}
                className="group flex flex-col justify-between rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 hover:border-[#0F172A] transition-colors space-y-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-500">
                      {campaign.category}
                    </span>
                    <TrustBadge variant="emerald">
                      {campaign.prototypeAndMilestones.readinessStage}
                    </TrustBadge>
                  </div>

                  <h3 className="text-base font-semibold text-[#0F172A] group-hover:underline">
                    {campaign.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                    {campaign.subtitle}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-[#E2E8F0] tabular-nums">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-semibold text-[#0F172A]">
                      {formatPaiseToINR(campaign.pledgedAmountPaise, {
                        includePaiseDecimals: false,
                      })}
                    </span>
                    <span className="font-mono text-[#16A34A] font-semibold">
                      {percentFunded}% of{" "}
                      {formatPaiseToINR(campaign.goalAmountPaise, {
                        includePaiseDecimals: false,
                      })}
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-[#16A34A]"
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{campaign.backerCount} Backers</span>
                    <span>{daysLeft} Days Left</span>
                    <span className="font-medium text-[#0F172A]">
                      View Project →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Curated Verticals Reference */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-[#0F172A]">
            Strictly Curated Verticals
          </h2>
          <span className="text-xs font-mono text-slate-500">
            NO CHARITY · NO EQUITY · REWARD &amp; PRE-ORDER ONLY
          </span>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {ALLOWED_VERTICALS.map((v) => (
            <div
              key={v.code}
              className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-6 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">
                  {v.code}
                </span>
                <TrustBadge variant="slate">
                  HSN {v.defaultHsnCode} · {v.defaultGstSlab}% GST
                </TrustBadge>
              </div>
              <h3 className="text-base font-semibold text-[#0F172A]">
                {v.label}
              </h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Escrow Tranche Transparency Preview */}
      <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Milestone Escrow Schedule Preview (Sample Campaign:{" "}
              {formatPaiseToINR(sampleSchedule.totalGrossAmountPaise)})
            </h2>
            <p className="text-xs text-slate-500">
              Calculated in integer paise (`bigint`) via{" "}
              <code>/lib/finance/calculator.ts</code> with zero rounding drift.
            </p>
          </div>
          <TrustBadge variant="emerald">ACID Double-Entry Verified</TrustBadge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm tabular-nums">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] text-xs font-medium uppercase text-slate-500">
                <th className="py-3 px-4">Milestone Tranche</th>
                <th className="py-3 px-4 text-right">Gross Allocation</th>
                <th className="py-3 px-4 text-right">Platform Fee (5%)</th>
                <th className="py-3 px-4 text-right">GST on Fee (18%)</th>
                <th className="py-3 px-4 text-right">Net Creator Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {sampleSchedule.tranches.map((tranche) => (
                <tr key={tranche.trancheNumber}>
                  <td className="py-3 px-4 font-mono text-xs font-medium text-[#0F172A]">
                    {tranche.trancheNumber}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {formatPaiseToINR(tranche.grossAmountPaise)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    -{formatPaiseToINR(tranche.platformFeePaise)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    -{formatPaiseToINR(tranche.gstOnFeePaise)}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-[#16A34A]">
                    {formatPaiseToINR(tranche.netPayoutPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-[#E2E8F0] bg-[#FAFAFA] font-semibold text-[#0F172A]">
                <td className="py-3 px-4">Total (100.00%)</td>
                <td className="py-3 px-4 text-right">
                  {formatPaiseToINR(sampleSchedule.totalGrossAmountPaise)}
                </td>
                <td className="py-3 px-4 text-right">
                  -{formatPaiseToINR(sampleSchedule.totalPlatformFeePaise)}
                </td>
                <td className="py-3 px-4 text-right">
                  -{formatPaiseToINR(sampleSchedule.totalGstOnFeePaise)}
                </td>
                <td className="py-3 px-4 text-right text-[#16A34A]">
                  {formatPaiseToINR(sampleSchedule.totalNetPayoutPaise)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
