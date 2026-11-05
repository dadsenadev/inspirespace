import type { Metadata } from "next";
import { CreatorOnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = {
  title: "Creator KYB/KYC & Razorpay Route Onboarding | Inspirespace",
  description:
    "Mandatory PAN, GSTIN, Bank Penny-Drop, and Razorpay Route Linked Account verification for Indian creators.",
};

export default function CreatorOnboardingPage() {
  return <CreatorOnboardingWizard />;
}

