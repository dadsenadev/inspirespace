import type { Metadata } from "next";
import { CampaignBuilder } from "@/components/creator/campaign-builder";

export const metadata: Metadata = {
  title: "New Campaign & Milestone Escrow Builder | Inspirespace Studio",
  description:
    "Create an All-or-Nothing pre-order campaign with GST-compliant reward tiers and 30/40/30 manufacturing tranches.",
};

export default function NewCampaignPage() {
  return <CampaignBuilder mode="create" />;
}

