import type { Metadata } from "next";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  ALLOWED_VERTICALS,
  SEED_CAMPAIGNS,
  findCampaignBySlug,
  computeCampaignProgressMetrics,
} from "@/lib/campaigns/catalog";
import { formatPaiseToINR } from "@/lib/finance/calculator";
import { ProjectTierSelector } from "@/components/public/project-tier-selector";

export const metadata: Metadata = {
  title: "Escrow-Protected Project Pre-Order | Inspirespace Launchpad",
  description:
    "Inspect DVT prototype proof, 30/40/30 manufacturing escrow milestones, and back verified Indian creators.",
};

export default async function PublicProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = findCampaignBySlug(slug) ?? SEED_CAMPAIGNS[0]!;
  const verticalMeta = ALLOWED_VERTICALS.find(
    (v) => v.code === campaign.category
  );
  const { percentFunded, daysLeft, escrowSchedule } =
    computeCampaignProgressMetrics(campaign);

  const serializableTiers = campaign.rewardTiers.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    pricePaiseStr: t.pricePaise.toString(),
    hsnCode: t.hsnCode,
    gstPercentage: t.gstPercentage,
    earlyBirdLimit: t.earlyBirdLimit,
    claimedCount: t.claimedCount,
    itemizedInclusions: t.itemizedInclusions,
    estimatedDeliveryDate: t.estimatedDeliveryDate,
    shippingScope: t.shippingScope,
    domesticShippingPaiseStr: t.domesticShippingPaise.toString(),
  }));

  const serializableAddons = campaign.addons.map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    pricePaiseStr: a.pricePaise.toString(),
    stockLimit: a.stockLimit,
    claimedCount: a.claimedCount,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 space-y-10">
      {/* Top Breadcrumb & KYB Counterparty Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-4">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <Link href="/" className="font-medium text-slate-500 hover:underline">
            Curated Projects
          </Link>
          <span className="text-slate-300">/</span>
          <span className="font-mono font-semibold text-[#0F172A]">
            {verticalMeta?.label ?? campaign.category}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <TrustBadge variant="emerald">
            KYB Verified: {campaign.creatorLegalName}
          </TrustBadge>
          <span className="rounded border border-[#E2E8F0] bg-[#FAFAFA] px-2.5 py-0.5 font-mono text-xs text-slate-700">
            GSTIN: {campaign.creatorGstin}
          </span>
          <Link
            href={`/campaigns/${campaign.id}/edit`}
            className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-0.5 text-xs font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
          >
            Edit in Studio ↗
          </Link>
        </div>
      </div>

      {/* Project Title & Subtitle Header */}
      <div className="max-w-4xl space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <TrustBadge variant="emerald">
            {campaign.prototypeAndMilestones.readinessStage}
          </TrustBadge>
          <TrustBadge variant="slate">
            ALL_OR_NOTHING · 30% / 40% / 30% ESCROW
          </TrustBadge>
          <span className="text-xs text-slate-500">
            📍 {campaign.creatorLocation}
          </span>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
          {campaign.title}
        </h1>
        <p className="text-base text-slate-600 leading-relaxed">
          {campaign.subtitle}
        </p>
      </div>

      {/* Main 2-Column Layout: Left Story/Proof/Tranches, Right Sticky Reward Selector */}
      <div className="grid gap-10 lg:grid-cols-12 items-start">
        {/* Left Column (7 cols) */}
        <div className="space-y-8 lg:col-span-7">
          {/* Hero Pitch Video / Keyshot Frame */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-6 space-y-4">
            <div className="flex aspect-video w-full flex-col items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] p-6 text-center space-y-2">
              <TrustBadge variant="emerald">
                Verified Uncut Prototype &amp; Pitch Video
              </TrustBadge>
              <p className="text-sm font-semibold text-[#0F172A]">
                {campaign.title}
              </p>
              <p className="font-mono text-xs text-slate-500">
                Stream Source: {campaign.pitchVideoUrl}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                CAD / Uncut Working Prototype Video:{" "}
                <code className="font-mono text-[#0F172A]">
                  {campaign.prototypeAndMilestones.cadOrWorkingVideoUrl}
                </code>
              </span>
              <span className="font-mono text-[#16A34A]">
                ✓ Inspected by Platform Hardware Team
              </span>
            </div>
          </div>

          {/* Mandatory Prototype & Manufacturing Evidence Card */}
          <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Prototype &amp; Manufacturing Verification Dossier
                </h2>
                <p className="text-xs text-slate-500">
                  Submitted by {campaign.creatorLegalName} prior to campaign
                  activation
                </p>
              </div>
              <TrustBadge variant="emerald">
                {campaign.prototypeAndMilestones.readinessStage}
              </TrustBadge>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {campaign.prototypeAndMilestones.engineeringSummary}
            </p>

            <div className="space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Verified Engineering &amp; QC Artifacts on File
              </span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {campaign.prototypeAndMilestones.prototypePhotoUrls.map(
                  (artifact, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-2 font-mono text-xs text-[#0F172A]"
                    >
                      <span className="truncate">📄 {artifact}</span>
                      <span className="text-[#16A34A] shrink-0 ml-2">
                        Verified
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          </section>

          {/* 3-Tranche Manufacturing Escrow Roadmap */}
          <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-5">
            <div className="border-b border-[#E2E8F0] pb-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-[#0F172A]">
                  3-Tranche Milestone Escrow Release Schedule (30% → 40% → 30%)
                </h2>
                <TrustBadge variant="emerald">Zero-Drift Paise Audit</TrustBadge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Backer funds are never handed over in a lump sum. Each tranche
                requires documentary proof verified by our compliance team.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  plan: campaign.prototypeAndMilestones.milestone1Plan,
                  calc: escrowSchedule.tranches[0],
                },
                {
                  plan: campaign.prototypeAndMilestones.milestone2Plan,
                  calc: escrowSchedule.tranches[1],
                },
                {
                  plan: campaign.prototypeAndMilestones.milestone3Plan,
                  calc: escrowSchedule.tranches[2],
                },
              ].map(({ plan, calc }, idx) => (
                <div
                  key={plan.trancheCode}
                  className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F172A] font-mono text-[11px] font-semibold text-[#FFFFFF]">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-semibold text-[#0F172A]">
                        {plan.title}
                      </span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-[#16A34A] tabular-nums">
                      Gross: {formatPaiseToINR(calc.grossAmountPaise)} (Net:{" "}
                      {formatPaiseToINR(calc.netPayoutPaise)})
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    <strong>Deliverable:</strong> {plan.deliverableScope}
                  </p>
                  <p className="text-xs text-slate-500">
                    <strong>Mandatory Audit Proof Required:</strong>{" "}
                    {plan.verificationArtifactRequired}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Campaign Story & Risk Disclosure */}
          <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
            <h2 className="text-base font-semibold text-[#0F172A] border-b border-[#E2E8F0] pb-3">
              Product Architecture &amp; Campaign Story
            </h2>
            <div className="whitespace-pre-line text-sm text-slate-700 leading-relaxed">
              {campaign.storyMarkdown}
            </div>

            <div className="mt-6 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4 space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                Manufacturing &amp; Supply Chain Risk Disclosure
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {campaign.riskDisclosure}
              </p>
            </div>
          </section>
        </div>

        {/* Right Column (5 cols): Sticky Reward Tier Selector & Trust Callout */}
        <div className="lg:col-span-5">
          <ProjectTierSelector
            campaignTitle={campaign.title}
            pledgedFormatted={formatPaiseToINR(campaign.pledgedAmountPaise, {
              includePaiseDecimals: false,
            })}
            goalFormatted={formatPaiseToINR(campaign.goalAmountPaise, {
              includePaiseDecimals: false,
            })}
            percentFunded={percentFunded}
            backerCount={campaign.backerCount}
            daysLeft={daysLeft}
            tiers={serializableTiers}
            addons={serializableAddons}
          />
        </div>
      </div>
    </div>
  );
}

