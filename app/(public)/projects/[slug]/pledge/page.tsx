import type { Metadata } from "next";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import { SEED_CAMPAIGNS, findCampaignBySlug } from "@/lib/campaigns/catalog";
import { PledgeCheckoutFlow } from "@/components/public/pledge-checkout-flow";

export const metadata: Metadata = {
  title: "Escrow Pre-Order Checkout | Inspirespace Launchpad",
  description:
    "Lock your Early-Bird reward slot and complete your GST-compliant All-or-Nothing escrow pledge via Razorpay.",
};

export default async function ProjectPledgeCheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tier?: string; addons?: string }>;
}) {
  const { slug } = await params;
  const resolvedSearch = await searchParams;
  const campaign = findCampaignBySlug(slug) ?? SEED_CAMPAIGNS[0]!;

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

  const initialAddonIds = resolvedSearch.addons
    ? resolvedSearch.addons.split(",").filter(Boolean)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E2E8F0] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link href={`/projects/${campaign.slug}`} className="hover:underline">
              ← Back to {campaign.title}
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F172A]">
            Escrow Pre-Order &amp; Reward Checkout
          </h1>
        </div>
        <TrustBadge variant="emerald">
          Razorpay Nodal Escrow · Atomic Early-Bird Lock
        </TrustBadge>
      </div>

      <PledgeCheckoutFlow
        campaignId={campaign.id}
        campaignSlug={campaign.slug}
        campaignTitle={campaign.title}
        creatorLegalName={campaign.creatorLegalName}
        creatorGstin={campaign.creatorGstin}
        tiers={serializableTiers}
        addons={serializableAddons}
        {...(resolvedSearch.tier ? { initialTierId: resolvedSearch.tier } : {})}
        initialAddonIds={initialAddonIds}
      />
    </div>
  );
}

