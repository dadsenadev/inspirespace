import type { Metadata } from "next";
import { CampaignBuilder } from "@/components/creator/campaign-builder";
import { findCampaignById, SEED_CAMPAIGNS } from "@/lib/campaigns/catalog";

export const metadata: Metadata = {
  title: "Edit Campaign & Reward Tiers | Inspirespace Studio",
  description:
    "Edit campaign specifications, pre-order reward tiers, early-bird counters, and 3-tranche manufacturing proofs.",
};

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = findCampaignById(id) ?? SEED_CAMPAIGNS[0];

  return <CampaignBuilder mode="edit" initialCampaign={campaign} />;
}

