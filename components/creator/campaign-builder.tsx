"use client";

import * as React from "react";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  VerificationStatusBanner,
  KYC_STORAGE_KEY,
  type KycVerificationStatus,
} from "@/components/creator/verification-status-banner";
import {
  ALLOWED_VERTICALS,
  type CampaignCategoryCode,
  type CampaignModel,
  type ShippingScopeCode,
} from "@/lib/campaigns/catalog";
import {
  calculateEscrowTrancheSchedule,
  calculatePledgeCheckout,
  formatPaiseToINR,
} from "@/lib/finance/calculator";
import {
  saveCampaignAndTiersAction,
  type TierInputPayload,
  type AddonInputPayload,
  type SaveCampaignActionResponse,
} from "@/app/(creator-studio)/campaigns/actions";

export interface CampaignBuilderProps {
  mode: "create" | "edit";
  initialCampaign?: CampaignModel;
}

type BuilderTab = "BASICS" | "TIERS_AND_ADDONS" | "PROTOTYPE_AND_MILESTONES";

export function CampaignBuilder({
  mode,
  initialCampaign,
}: CampaignBuilderProps) {
  const [activeTab, setActiveTab] = React.useState<BuilderTab>("BASICS");
  const [kycStatus, setKycStatus] =
    React.useState<KycVerificationStatus>("DRAFT");
  const [isPending, startTransition] = React.useTransition();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [saveResult, setSaveResult] =
    React.useState<SaveCampaignActionResponse | null>(null);

  // Sync creator KYC status from localStorage so the publishing gate reacts live
  React.useEffect(() => {
    const syncKyc = () => {
      try {
        const raw = window.localStorage.getItem(KYC_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { kycStatus?: KycVerificationStatus };
          if (parsed.kycStatus) {
            setKycStatus(parsed.kycStatus);
          }
        }
      } catch {
        // Ignore parse error
      }
    };
    syncKyc();
    window.addEventListener("inspirespace-kyc-updated", syncKyc);
    return () =>
      window.removeEventListener("inspirespace-kyc-updated", syncKyc);
  }, []);

  // ==========================================================================
  // TAB 1 STATE: BASICS
  // ==========================================================================
  const [title, setTitle] = React.useState(
    initialCampaign?.title ??
      "Vayu-1: Open-Source Matter & VOC Air Quality Telemetry Station"
  );
  const [subtitle, setSubtitle] = React.useState(
    initialCampaign?.subtitle ??
      "CNC-machined anodized aluminum desktop air quality monitor with Sensirion SEN55 Particulate/VOC sensors and local Matter-over-Thread telemetry."
  );
  const [slug, setSlug] = React.useState(
    initialCampaign?.slug ?? "vayu-1-open-source-air-quality-telemetry"
  );
  const [category, setCategory] = React.useState<CampaignCategoryCode>(
    initialCampaign?.category ?? "HARDWARE_IOT"
  );
  const [goalAmountInr, setGoalAmountInr] = React.useState<number>(
    initialCampaign ? Number(initialCampaign.goalAmountPaise / 100n) : 2_500_000
  );
  const [durationDays, setDurationDays] = React.useState<number>(
    initialCampaign?.durationDays ?? 45
  );
  const [pitchVideoUrl, setPitchVideoUrl] = React.useState(
    initialCampaign?.pitchVideoUrl ??
      "https://player.vimeo.com/video/vayu1-evt-demo"
  );
  const [heroImageName, setHeroImageName] = React.useState(
    initialCampaign?.heroImageUrl ?? "Vayu1_CNC_6061_Hero_Render.png"
  );
  const [storyMarkdown, setStoryMarkdown] = React.useState(
    initialCampaign?.storyMarkdown ??
      "### Engineered for Indian Urban Micro-Climates\n\nBuilt with Swiss Sensirion SEN55 + SCD41 NDIR CO2 sensors, bead-blasted 6061-T6 aluminum enclosure, and open-source ESPHome firmware."
  );
  const [riskDisclosure, setRiskDisclosure] = React.useState(
    initialCampaign?.riskDisclosure ??
      "Sensor optical modules have a 4-week lead time; we have locked pro-forma allocation with our authorized distributor in Mumbai and backup CNC machining in Pune."
  );

  // ==========================================================================
  // TAB 2 STATE: REWARD TIERS & ADD-ONS
  // ==========================================================================
  const [tiers, setTiers] = React.useState<TierInputPayload[]>(() => {
    if (initialCampaign && initialCampaign.rewardTiers.length > 0) {
      return initialCampaign.rewardTiers.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        priceInr: Number(t.pricePaise / 100n),
        hsnCode: t.hsnCode,
        gstPercentage: t.gstPercentage,
        earlyBirdLimit: t.earlyBirdLimit,
        claimedCount: t.claimedCount,
        itemizedInclusions: [...t.itemizedInclusions],
        estimatedDeliveryDate: t.estimatedDeliveryDate,
        shippingScope: t.shippingScope,
        domesticShippingInr: Number(t.domesticShippingPaise / 100n),
      }));
    }
    return [
      {
        id: "tier_1",
        title: "Early-Bird Founder Edition (CNC Silver)",
        description:
          "First-batch Vayu-1 Station with laser-etched serial number (001–100) and braided USB-C cable.",
        priceInr: 7999,
        hsnCode: "9027",
        gstPercentage: 18,
        earlyBirdLimit: 100,
        claimedCount: 88,
        itemizedInclusions: [
          "Vayu-1 CNC Aluminum Air Telemetry Unit",
          "Sensirion SEN55 + SCD41 NDIR CO2 Sensor Module",
          "2m Braided USB-C Cable & Calibration Certificate",
        ],
        estimatedDeliveryDate: "2027-02-15",
        shippingScope: "INDIA_ONLY",
        domesticShippingInr: 150,
      },
      {
        id: "tier_2",
        title: "Standard Pre-Order Batch 1 (Anodized Slate)",
        description:
          "Complete Vayu-1 Air Quality Station in matte Slate Grey or Natural Silver.",
        priceInr: 8999,
        hsnCode: "9027",
        gstPercentage: 18,
        earlyBirdLimit: 250,
        claimedCount: 112,
        itemizedInclusions: [
          "Vayu-1 CNC Aluminum Air Telemetry Unit",
          "Sensirion SEN55 + SCD41 NDIR CO2 Sensor Module",
          "1-Year Domestic Replacement Warranty",
        ],
        estimatedDeliveryDate: "2027-03-01",
        shippingScope: "INDIA_ONLY",
        domesticShippingInr: 150,
      },
    ];
  });

  const [addons, setAddons] = React.useState<AddonInputPayload[]>(() => {
    if (initialCampaign && initialCampaign.addons.length > 0) {
      return initialCampaign.addons.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        priceInr: Number(a.pricePaise / 100n),
        stockLimit: a.stockLimit,
      }));
    }
    return [
      {
        id: "addon_1",
        name: "Machined Brass 15° Angled Desk Stand",
        description:
          "Heavyweight solid C36000 brass desk cradle with silicone isolation pads.",
        priceInr: 1299,
        stockLimit: 150,
      },
    ];
  });

  const [newInclusionDrafts, setNewInclusionDrafts] = React.useState<
    Record<string, string>
  >({});

  // ==========================================================================
  // TAB 3 STATE: PROTOTYPE & 3-TRANCHE MANUFACTURING PROOF
  // ==========================================================================
  const [readinessStage, setReadinessStage] = React.useState<
    "EVT_PROTOTYPE" | "DVT_VERIFIED" | "PVT_TOOLING_READY"
  >(initialCampaign?.prototypeAndMilestones.readinessStage ?? "DVT_VERIFIED");

  const [prototypePhotos, setPrototypePhotos] = React.useState<string[]>(
    initialCampaign?.prototypeAndMilestones.prototypePhotoUrls ?? [
      "EVT3_4Layer_ImmersionGold_PCB_Top.jpg",
      "CNC_6061_Enclosure_FirstArticle_Inspection.jpg",
    ]
  );

  const [cadOrWorkingVideoUrl, setCadOrWorkingVideoUrl] = React.useState(
    initialCampaign?.prototypeAndMilestones.cadOrWorkingVideoUrl ??
      "https://vimeo.com/inspirespace/vayu1-uncut-dvt"
  );

  const [engineeringSummary, setEngineeringSummary] = React.useState(
    initialCampaign?.prototypeAndMilestones.engineeringSummary ??
      "12 DVT units have been running 24/7 for 45 days in Bengaluru and Delhi NCR. 4-layer ENIG PCBs are panelized and verified."
  );

  const [milestone1Deliverable, setMilestone1Deliverable] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone1Plan.deliverableScope ??
      "Place firm PO for 400× Sensirion SEN55 + SCD41 sensor reels, ESP32-C6 modules, and 6061 aluminum billets."
  );
  const [milestone1ProofRequired, setMilestone1ProofRequired] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone1Plan
      .verificationArtifactRequired ??
      "Signed vendor tax invoices & NEFT/RTGS remittance receipts for sensor and PCB fabrication orders."
  );

  const [milestone2Deliverable, setMilestone2Deliverable] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone2Plan.deliverableScope ??
      "Complete SMT pick-and-place assembly, CNC machining, anodizing, and 24-hour burn-in calibration of all batch units."
  );
  const [milestone2ProofRequired, setMilestone2ProofRequired] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone2Plan
      .verificationArtifactRequired ??
      "Factory SMT QA pass certificates, timestamped assembly line video, and serial-numbered calibration logs."
  );

  const [milestone3Deliverable, setMilestone3Deliverable] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone3Plan.deliverableScope ??
      "Custom molded pulp packaging, GST tax invoice generation, and handover to BlueDart / Delhivery with AWB tracking."
  );
  const [milestone3ProofRequired, setMilestone3ProofRequired] = React.useState(
    initialCampaign?.prototypeAndMilestones.milestone3Plan
      .verificationArtifactRequired ??
      "Verified logistics manifest with live AWB tracking numbers for >=95% of domestic backer pledges."
  );

  // ==========================================================================
  // LIVE INTEGER PAISE & ESCROW SCHEDULE CALCULATIONS
  // ==========================================================================
  const safeGoalInr =
    Number.isFinite(goalAmountInr) && goalAmountInr > 0 ? goalAmountInr : 10000;
  const goalAmountPaise = BigInt(Math.round(safeGoalInr * 100));
  const liveEscrowSchedule = calculateEscrowTrancheSchedule(goalAmountPaise, {
    tdsTcsRateBps: 0n,
  });

  // Handlers for dynamic Reward Tiers
  const addRewardTier = () => {
    const selectedVertical = ALLOWED_VERTICALS.find((v) => v.code === category);
    setTiers((prev) => [
      ...prev,
      {
        id: `tier_${Date.now()}`,
        title: `Batch Pre-Order Tier #${prev.length + 1}`,
        description: "Complete reward package with domestic GST invoice.",
        priceInr: 4999,
        hsnCode: selectedVertical?.defaultHsnCode ?? "8517",
        gstPercentage: selectedVertical?.defaultGstSlab ?? 18,
        earlyBirdLimit: 100,
        claimedCount: 0,
        itemizedInclusions: ["Core Product Unit", "1-Year Domestic Warranty"],
        estimatedDeliveryDate: "2027-03-15",
        shippingScope: "INDIA_ONLY",
        domesticShippingInr: 150,
      },
    ]);
  };

  const removeRewardTier = (id: string) => {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, patch: Partial<TierInputPayload>) => {
    setTiers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch } : t))
    );
  };

  const addInclusionItem = (tierId: string) => {
    const text = (newInclusionDrafts[tierId] ?? "").trim();
    if (!text) return;
    setTiers((prev) =>
      prev.map((t) =>
        t.id === tierId
          ? { ...t, itemizedInclusions: [...t.itemizedInclusions, text] }
          : t
      )
    );
    setNewInclusionDrafts((prev) => ({ ...prev, [tierId]: "" }));
  };

  const removeInclusionItem = (tierId: string, idx: number) => {
    setTiers((prev) =>
      prev.map((t) =>
        t.id === tierId
          ? {
              ...t,
              itemizedInclusions: t.itemizedInclusions.filter(
                (_, i) => i !== idx
              ),
            }
          : t
      )
    );
  };

  // Handlers for dynamic Add-ons
  const addCampaignAddon = () => {
    setAddons((prev) => [
      ...prev,
      {
        id: `addon_${Date.now()}`,
        name: `Accessory Add-on #${prev.length + 1}`,
        description: "Optional companion add-on shipped in the same box.",
        priceInr: 999,
        stockLimit: 100,
      },
    ]);
  };

  const removeCampaignAddon = (id: string) => {
    setAddons((prev) => prev.filter((a) => a.id !== id));
  };

  // Save / Submit Handler
  const handleSave = (targetStatus: "DRAFT" | "UNDER_REVIEW") => {
    setErrorMessage(null);
    setSaveResult(null);

    startTransition(async () => {
      const response = await saveCampaignAndTiersAction({
        ...(initialCampaign?.id ? { campaignId: initialCampaign.id } : {}),
        creatorId: "00000000-0000-4000-8000-000000000101",
        kycStatus,
        targetStatus,
        title,
        subtitle,
        slug,
        category,
        goalAmountInr: safeGoalInr,
        durationDays,
        pitchVideoUrl,
        storyMarkdown,
        riskDisclosure,
        tiers,
        addons,
        readinessStage,
        prototypePhotoNames: prototypePhotos,
        cadOrWorkingVideoUrl,
        engineeringSummary,
        milestone1Deliverable,
        milestone1ProofRequired,
        milestone2Deliverable,
        milestone2ProofRequired,
        milestone3Deliverable,
        milestone3ProofRequired,
      });

      if (!response.success) {
        setErrorMessage(response.error ?? "Failed to save campaign.");
        return;
      }

      setSaveResult(response);
    });
  };

  return (
    <div className="space-y-8">
      {/* Mandatory KYC Publishing Lock Banner */}
      <VerificationStatusBanner showPublishGateAction={false} />

      {/* Header & Actions */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 lg:flex-row lg:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <TrustBadge variant="slate">
              {mode === "create" ? "NEW CAMPAIGN BUILDER" : `EDIT: ${initialCampaign?.id}`}
            </TrustBadge>
            <span className="font-mono text-xs text-slate-500">
              ALL-OR-NOTHING NODAL ESCROW · 30% / 40% / 30%
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0F172A]">
            {mode === "create"
              ? "Launch a Curated Pre-Order & Reward Campaign"
              : `Edit Campaign: ${title}`}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/projects/${slug}`}
            className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-slate-100 transition-colors"
          >
            Preview Public Storefront ↗
          </Link>

          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSave("DRAFT")}
            className="rounded-md border border-[#0F172A] bg-[#FFFFFF] px-4 py-2 text-xs font-semibold text-[#0F172A] hover:bg-[#FAFAFA] disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save Draft (Paise Verified)"}
          </button>

          <button
            type="button"
            disabled={isPending || kycStatus !== "APPROVED"}
            onClick={() => handleSave("UNDER_REVIEW")}
            title={
              kycStatus === "APPROVED"
                ? "Submit campaign and lock 30/40/30 escrow schedule"
                : "Locked until Creator KYB/KYC is APPROVED"
            }
            className={
              kycStatus === "APPROVED"
                ? "rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#15803D] transition-colors"
                : "cursor-not-allowed rounded-md border border-[#E2E8F0] bg-slate-100 px-4 py-2 text-xs font-medium text-slate-400"
            }
          >
            {kycStatus === "APPROVED"
              ? "✓ Submit Campaign for Launch"
              : "🔒 Submit Locked (Complete KYC in Onboarding)"}
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {errorMessage && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900"
        >
          {errorMessage}
        </div>
      )}

      {saveResult?.success && (
        <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TrustBadge variant="emerald">
              SAVED &amp; PAISE LEDGER SCHEDULE GENERATED
            </TrustBadge>
            <span className="font-mono text-xs text-[#0F172A]">
              Goal: {saveResult.goalFormattedInr} ({saveResult.goalAmountPaiseString}{" "}
              paise)
            </span>
          </div>
          <p className="text-xs text-slate-700">
            Campaign saved with slug{" "}
            <code className="font-mono font-semibold">{saveResult.slug}</code>{" "}
            and pre-allocated across 3 integer-paise escrow tranches with zero
            rounding drift.
          </p>
        </div>
      )}

      {/* 3-Tab Navigation Bar */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            id: "BASICS" as const,
            step: "Tab 1",
            title: "Basics & Vertical Lock",
            subtitle: "3 Curated Verticals · Goal in Paise · 15–60 Days",
          },
          {
            id: "TIERS_AND_ADDONS" as const,
            step: "Tab 2",
            title: "Reward Tiers, HSN/GST & Add-ons",
            subtitle: `Early-Bird Counters · ${tiers.length} Tiers · ${addons.length} Add-ons`,
          },
          {
            id: "PROTOTYPE_AND_MILESTONES" as const,
            step: "Tab 3",
            title: "Prototype & 3-Tranche Proof",
            subtitle: "EVT/DVT Proof · 30% -> 40% -> 30% Milestones",
          },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                active
                  ? "border-[#0F172A] bg-[#FFFFFF] ring-1 ring-[#0F172A]"
                  : "border-[#E2E8F0] bg-[#FAFAFA] hover:bg-[#FFFFFF]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-slate-500">
                  {tab.step}
                </span>
                {active && <TrustBadge variant="emerald">Active Tab</TrustBadge>}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#0F172A]">
                {tab.title}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{tab.subtitle}</p>
            </button>
          );
        })}
      </div>

      {/* =====================================================================
          TAB 1: BASICS (STRICT 3 VERTICALS, GOAL IN PAISE, 15-60 DAYS)
          ===================================================================== */}
      {activeTab === "BASICS" && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6">
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Tab 1: Campaign Identity, Strictly Curated Vertical &amp; Goal
            </h2>
            <p className="text-xs text-slate-500">
              Funding goals entered in ₹ INR are converted to `BIGINT` paise on
              save (`1 INR = 100 paise`).
            </p>
          </div>

          {/* Strictly Locked 3-Vertical Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                Curated Platform Vertical (Strictly Locked to 3 Allowed
                Categories) *
              </label>
              <span className="font-mono text-[11px] text-slate-500">
                ENUM: HARDWARE_IOT | GAMES_COMICS | D2C_ARTISANAL
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {ALLOWED_VERTICALS.map((v) => {
                const isSelected = category === v.code;
                return (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => setCategory(v.code)}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                        : "border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#0F172A]">
                        {v.code}
                      </span>
                      <TrustBadge variant={isSelected ? "emerald" : "slate"}>
                        Default {v.defaultGstSlab}% GST
                      </TrustBadge>
                    </div>
                    <h3 className="mt-2 text-sm font-semibold text-[#0F172A]">
                      {v.label}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                      {v.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="cmpTitle"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Campaign Title *
              </label>
              <input
                id="cmpTitle"
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (mode === "create") {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, "")
                    );
                  }
                }}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="cmpSubtitle"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Industrial Design Subtitle / Value Proposition *
              </label>
              <input
                id="cmpSubtitle"
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            {/* Funding Goal in INR -> Paise */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cmpGoalInr"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  All-or-Nothing Funding Goal (₹ INR) *
                </label>
                <span className="font-mono text-xs text-[#16A34A]">
                  = {goalAmountPaise.toString()} paise (BIGINT)
                </span>
              </div>
              <input
                id="cmpGoalInr"
                type="number"
                min={10000}
                step={1000}
                value={goalAmountInr}
                onChange={(e) => setGoalAmountInr(Number(e.target.value))}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
              <p className="text-xs text-slate-500">
                Formatted Goal:{" "}
                <strong className="text-[#0F172A]">
                  {formatPaiseToINR(goalAmountPaise)}
                </strong>{" "}
                · Net Creator Payout after 5% Fee + 18% GST:{" "}
                <strong className="text-[#16A34A]">
                  {formatPaiseToINR(liveEscrowSchedule.totalNetPayoutPaise)}
                </strong>
              </p>
            </div>

            {/* Campaign Duration (15 to 60 days) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cmpDuration"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  Campaign Duration (Strictly 15 to 60 Days) *
                </label>
                <span className="font-mono text-xs font-semibold text-[#0F172A]">
                  {durationDays} Days
                </span>
              </div>
              <div className="flex items-center gap-4">
                <input
                  id="cmpDuration"
                  type="range"
                  min={15}
                  max={60}
                  value={durationDays}
                  onChange={(e) => setDurationDays(Number(e.target.value))}
                  className="w-full accent-[#0F172A]"
                />
                <input
                  type="number"
                  min={15}
                  max={60}
                  value={durationDays}
                  onChange={(e) =>
                    setDurationDays(
                      Math.min(60, Math.max(15, Number(e.target.value) || 15))
                    )
                  }
                  className="w-20 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-center font-mono text-sm"
                />
              </div>
              <p className="text-xs text-slate-500">
                Shorter campaigns (30–45 days) achieve higher backer conversion
                velocity.
              </p>
            </div>

            {/* Hero Pitch Video & Image Uploader */}
            <div className="space-y-1.5">
              <label
                htmlFor="cmpPitchVideo"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Hero Pitch Video URL (YouTube / Vimeo / Mux Embed) *
              </label>
              <input
                id="cmpPitchVideo"
                type="url"
                value={pitchVideoUrl}
                onChange={(e) => setPitchVideoUrl(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-xs text-[#0F172A]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="cmpHeroImage"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Hero Keyshot / Product Photograph Upload
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="cmpHeroImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setHeroImageName(f.name);
                  }}
                  className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-[#E2E8F0] file:bg-[#FAFAFA] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#0F172A]"
                />
                <span className="font-mono text-[11px] text-[#16A34A] shrink-0">
                  {heroImageName}
                </span>
              </div>
            </div>

            {/* Story Markdown & Risk Disclosure */}
            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="cmpStory"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Engineering &amp; Product Story (Markdown) *
              </label>
              <textarea
                id="cmpStory"
                rows={4}
                value={storyMarkdown}
                onChange={(e) => setStoryMarkdown(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] p-3 font-mono text-xs text-[#0F172A]"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="cmpRisks"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Supply Chain, Tooling &amp; Regulatory Risk Disclosure *
              </label>
              <textarea
                id="cmpRisks"
                rows={3}
                value={riskDisclosure}
                onChange={(e) => setRiskDisclosure(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] p-3 text-xs text-[#0F172A]"
              />
            </div>
          </div>

          <div className="flex justify-end border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("TIERS_AND_ADDONS")}
              className="rounded-md bg-[#0F172A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800"
            >
              Next: Configure Reward Tiers &amp; GST Slabs (Tab 2) →
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: REWARD TIERS, EARLY-BIRD COUNTERS, HSN/GST & ADD-ONS
          ===================================================================== */}
      {activeTab === "TIERS_AND_ADDONS" && (
        <div className="space-y-8">
          {/* Reward Tiers Section */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6">
            <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-lg font-semibold text-[#0F172A]">
                  Tab 2A: Pre-Order Reward Tiers (`reward_tiers`)
                </h2>
                <p className="text-xs text-slate-500">
                  Configure GST-inclusive INR pricing, Early-Bird slot limits
                  with real-time remaining counters, HSN codes, and itemized box
                  inclusions.
                </p>
              </div>
              <button
                type="button"
                onClick={addRewardTier}
                className="rounded-md bg-[#0F172A] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800"
              >
                + Add Pre-Order Reward Tier
              </button>
            </div>

            <div className="space-y-6">
              {tiers.map((tier, index) => {
                const pricePaise = BigInt(
                  Math.max(100, Math.round((tier.priceInr || 0) * 100))
                );
                const taxBreakdown = calculatePledgeCheckout(
                  pricePaise,
                  0n,
                  BigInt(Math.round((tier.domesticShippingInr || 0) * 100)),
                  tier.gstPercentage
                );
                const remainingEarlyBirdSlots =
                  tier.earlyBirdLimit !== null
                    ? Math.max(0, tier.earlyBirdLimit - tier.claimedCount)
                    : null;

                return (
                  <div
                    key={tier.id}
                    className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-semibold text-[#0F172A]">
                          TIER #{index + 1}
                        </span>
                        {remainingEarlyBirdSlots !== null ? (
                          <TrustBadge
                            variant={
                              remainingEarlyBirdSlots > 0 ? "emerald" : "amber"
                            }
                          >
                            Early-Bird Counter: {remainingEarlyBirdSlots} of{" "}
                            {tier.earlyBirdLimit} Slots Remaining (
                            {tier.claimedCount} Claimed)
                          </TrustBadge>
                        ) : (
                          <TrustBadge variant="slate">
                            Open Batch (Unlimited Slots)
                          </TrustBadge>
                        )}
                      </div>

                      {tiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRewardTier(tier.id)}
                          className="text-xs font-medium text-red-600 hover:underline"
                        >
                          Remove Tier
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-1 md:col-span-2">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Tier Title *
                        </label>
                        <input
                          type="text"
                          value={tier.title}
                          onChange={(e) =>
                            updateTier(tier.id, { title: e.target.value })
                          }
                          className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-sm"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-semibold text-[#0F172A]">
                            Price (₹ INR, GST Inclusive) *
                          </label>
                          <span className="font-mono text-[11px] text-[#16A34A]">
                            {pricePaise.toString()} paise
                          </span>
                        </div>
                        <input
                          type="number"
                          min={100}
                          value={tier.priceInr}
                          onChange={(e) =>
                            updateTier(tier.id, {
                              priceInr: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 font-mono text-sm"
                        />
                      </div>

                      <div className="space-y-1 md:col-span-3">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Tier Description
                        </label>
                        <input
                          type="text"
                          value={tier.description}
                          onChange={(e) =>
                            updateTier(tier.id, { description: e.target.value })
                          }
                          className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs"
                        />
                      </div>

                      {/* Early-Bird Limit & Real-Time Claimed Simulator */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Early-Bird Slot Limit
                        </label>
                        <input
                          type="number"
                          min={1}
                          placeholder="Unlimited if blank"
                          value={tier.earlyBirdLimit ?? ""}
                          onChange={(e) =>
                            updateTier(tier.id, {
                              earlyBirdLimit: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 font-mono text-xs"
                        />
                      </div>

                      {/* HSN Code & GST Rate Slab */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          HSN Code &amp; Applicable GST Rate *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            maxLength={8}
                            placeholder="HSN 9027"
                            value={tier.hsnCode}
                            onChange={(e) =>
                              updateTier(tier.id, { hsnCode: e.target.value })
                            }
                            className="w-24 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-xs"
                          />
                          <select
                            value={tier.gstPercentage}
                            onChange={(e) =>
                              updateTier(tier.id, {
                                gstPercentage: Number(e.target.value),
                              })
                            }
                            className="flex-1 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium"
                          >
                            <option value={0}>0% GST (Exempt Books)</option>
                            <option value={5}>5% GST (Comics / Print)</option>
                            <option value={12}>
                              12% GST (Board Games / Craft)
                            </option>
                            <option value={18}>
                              18% GST (Hardware / IoT / Electronics)
                            </option>
                            <option value={28}>28% GST (Luxury Goods)</option>
                          </select>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Net Pre-Tax:{" "}
                          {formatPaiseToINR(taxBreakdown.netPreTaxRewardPaise)}{" "}
                          + Embedded GST:{" "}
                          {formatPaiseToINR(taxBreakdown.embeddedRewardGstPaise)}
                        </p>
                      </div>

                      {/* Estimated Delivery Date & Shipping Scope */}
                      <div className="space-y-1">
                        <label className="block text-xs font-semibold text-[#0F172A]">
                          Est. Delivery Date &amp; Shipping Scope *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="date"
                            value={tier.estimatedDeliveryDate}
                            onChange={(e) =>
                              updateTier(tier.id, {
                                estimatedDeliveryDate: e.target.value,
                              })
                            }
                            className="flex-1 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 font-mono text-xs"
                          />
                          <select
                            value={tier.shippingScope}
                            onChange={(e) =>
                              updateTier(tier.id, {
                                shippingScope: e.target
                                  .value as ShippingScopeCode,
                              })
                            }
                            className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1.5 text-xs"
                          >
                            <option value="INDIA_ONLY">INDIA_ONLY</option>
                            <option value="GLOBAL">GLOBAL</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Itemized Inclusions Builder */}
                    <div className="space-y-2 border-t border-[#E2E8F0] pt-3">
                      <label className="block text-xs font-semibold text-[#0F172A]">
                        Itemized Box Inclusions ({tier.itemizedInclusions.length}{" "}
                        items)
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {tier.itemizedInclusions.map((inc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#0F172A]"
                          >
                            <span>✓ {inc}</span>
                            <button
                              type="button"
                              onClick={() => removeInclusionItem(tier.id, i)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label={`Remove ${inc}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2 max-w-md">
                        <input
                          type="text"
                          placeholder="Add physical/digital item included in this tier..."
                          value={newInclusionDrafts[tier.id] ?? ""}
                          onChange={(e) =>
                            setNewInclusionDrafts((prev) => ({
                              ...prev,
                              [tier.id]: e.target.value,
                            }))
                          }
                          className="flex-1 rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => addInclusionItem(tier.id)}
                          className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1 text-xs font-semibold text-[#0F172A] hover:bg-slate-100"
                        >
                          + Add Item
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional Checkout Add-ons Section */}
          <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
              <div>
                <h2 className="text-base font-semibold text-[#0F172A]">
                  Tab 2B: Optional Checkout Add-ons (`campaign_addons`)
                </h2>
                <p className="text-xs text-slate-500">
                  Backers can attach these accessories or collector upgrades at
                  checkout.
                </p>
              </div>
              <button
                type="button"
                onClick={addCampaignAddon}
                className="rounded-md border border-[#0F172A] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-semibold text-[#0F172A] hover:bg-[#FAFAFA]"
              >
                + Add Checkout Add-on
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {addons.map((addon) => (
                <div
                  key={addon.id}
                  className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={addon.name}
                      onChange={(e) =>
                        setAddons((prev) =>
                          prev.map((a) =>
                            a.id === addon.id
                              ? { ...a, name: e.target.value }
                              : a
                          )
                        )
                      }
                      className="flex-1 rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 text-xs font-semibold"
                    />
                    <button
                      type="button"
                      onClick={() => removeCampaignAddon(addon.id)}
                      className="ml-3 text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Add-on Price (₹ INR)
                      </label>
                      <input
                        type="number"
                        min={50}
                        value={addon.priceInr}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((a) =>
                              a.id === addon.id
                                ? { ...a, priceInr: Number(e.target.value) }
                                : a
                            )
                          )
                        }
                        className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500">
                        Stock Limit
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={addon.stockLimit ?? ""}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((a) =>
                              a.id === addon.id
                                ? {
                                    ...a,
                                    stockLimit: e.target.value
                                      ? Number(e.target.value)
                                      : null,
                                  }
                                : a
                            )
                          )
                        }
                        className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
              <button
                type="button"
                onClick={() => setActiveTab("BASICS")}
                className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#0F172A]"
              >
                ← Back to Tab 1 (Basics)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("PROTOTYPE_AND_MILESTONES")}
                className="rounded-md bg-[#0F172A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800"
              >
                Next: Prototype &amp; 3-Tranche Milestones (Tab 3) →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: PROTOTYPE PROOF & 3-TRANCHE MILESTONE MAPPING (30/40/30)
          ===================================================================== */}
      {activeTab === "PROTOTYPE_AND_MILESTONES" && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6">
          <div className="border-b border-[#E2E8F0] pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0F172A]">
                Tab 3: Mandatory Prototype Verification &amp; 3-Tranche Escrow
                Milestones
              </h2>
              <TrustBadge variant="emerald">
                Anti-Vaporware Hardware Gate
              </TrustBadge>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              To protect Indian backers from vaporware, no campaign can go live
              without working prototype proof and explicit deliverables mapped to
              the 30% / 40% / 30% escrow releases.
            </p>
          </div>

          {/* Hardware / Prototype Evidence Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Hardware / Manufacturing Readiness Level *
              </label>
              <select
                value={readinessStage}
                onChange={(e) =>
                  setReadinessStage(
                    e.target.value as
                      | "EVT_PROTOTYPE"
                      | "DVT_VERIFIED"
                      | "PVT_TOOLING_READY"
                  )
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#0F172A]"
              >
                <option value="EVT_PROTOTYPE">
                  EVT_PROTOTYPE — Functional Engineering Breadboard / Alpha Sample
                </option>
                <option value="DVT_VERIFIED">
                  DVT_VERIFIED — Design Validation Complete &amp; BOM Finalized
                </option>
                <option value="PVT_TOOLING_READY">
                  PVT_TOOLING_READY — Production Molds / Pre-Press Signed Off
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Uncut Working Prototype / CAD Walkthrough Video URL *
              </label>
              <input
                type="url"
                value={cadOrWorkingVideoUrl}
                onChange={(e) => setCadOrWorkingVideoUrl(e.target.value)}
                placeholder="https://vimeo.com/inspirespace/uncut-dvt-demo"
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 font-mono text-xs text-[#0F172A]"
              />
            </div>

            <div className="space-y-2 md:col-span-2 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  Prototype Photos, PCB Gerbers, or First-Article QC Uploads *
                </label>
                <span className="font-mono text-xs text-[#16A34A]">
                  {prototypePhotos.length} verification file(s) attached
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {prototypePhotos.map((file, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2.5 py-1 font-mono text-xs text-[#0F172A]"
                  >
                    <span>📄 {file}</span>
                  </span>
                ))}
              </div>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.step,.iges"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []).map(
                    (f) => f.name
                  );
                  if (files.length > 0) {
                    setPrototypePhotos((prev) => [...prev, ...files]);
                  }
                }}
                className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border file:border-[#E2E8F0] file:bg-[#FFFFFF] file:px-3 file:py-1.5 file:text-xs file:font-medium"
              />
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Engineering &amp; DVT Validation Summary *
              </label>
              <textarea
                rows={2}
                value={engineeringSummary}
                onChange={(e) => setEngineeringSummary(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] p-3 text-xs"
              />
            </div>
          </div>

          {/* 3-Tranche Milestone Schedule Mapper */}
          <div className="space-y-4 pt-2">
            <h3 className="text-sm font-semibold text-[#0F172A]">
              3-Tranche Escrow Release Plan (Mapped to{" "}
              {formatPaiseToINR(goalAmountPaise)} Funding Goal)
            </h3>

            {/* Milestone 1: 30% */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#0F172A]">
                    MILESTONE 1 · TRANCHE_1_30_PCT (30% Release)
                  </span>
                  <p className="text-xs text-slate-600">
                    Campaign success &amp; initial BOM / raw material sourcing
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-slate-500">
                    Gross:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[0].grossAmountPaise
                    )}{" "}
                    →{" "}
                  </span>
                  <strong className="text-[#16A34A]">
                    Net Payout:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[0].netPayoutPaise
                    )}
                  </strong>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Committed Sourcing / BOM Deliverable *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone1Deliverable}
                    onChange={(e) => setMilestone1Deliverable(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Audit Proof Artifact Submitted for Release *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone1ProofRequired}
                    onChange={(e) => setMilestone1ProofRequired(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Milestone 2: 40% */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#0F172A]">
                    MILESTONE 2 · TRANCHE_2_40_PCT (40% Release)
                  </span>
                  <p className="text-xs text-slate-600">
                    Tooling, PCB assembly, or batch manufacturing proof
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-slate-500">
                    Gross:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[1].grossAmountPaise
                    )}{" "}
                    →{" "}
                  </span>
                  <strong className="text-[#16A34A]">
                    Net Payout:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[1].netPayoutPaise
                    )}
                  </strong>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Committed Tooling / Batch Production Deliverable *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone2Deliverable}
                    onChange={(e) => setMilestone2Deliverable(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Audit Proof Artifact Submitted for Release *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone2ProofRequired}
                    onChange={(e) => setMilestone2ProofRequired(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Milestone 3: 30% */}
            <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2E8F0] pb-2.5">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#0F172A]">
                    MILESTONE 3 · TRANCHE_3_30_PCT (30% Final Release)
                  </span>
                  <p className="text-xs text-slate-600">
                    Packaging &amp; courier dispatch proof (AWB manifests)
                  </p>
                </div>
                <div className="text-right font-mono text-xs">
                  <span className="text-slate-500">
                    Gross:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[2].grossAmountPaise
                    )}{" "}
                    →{" "}
                  </span>
                  <strong className="text-[#16A34A]">
                    Net Payout:{" "}
                    {formatPaiseToINR(
                      liveEscrowSchedule.tranches[2].netPayoutPaise
                    )}
                  </strong>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Committed Packaging &amp; Dispatch Deliverable *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone3Deliverable}
                    onChange={(e) => setMilestone3Deliverable(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#0F172A] mb-1">
                    Audit Proof Artifact Submitted for Release *
                  </label>
                  <textarea
                    rows={2}
                    value={milestone3ProofRequired}
                    onChange={(e) => setMilestone3ProofRequired(e.target.value)}
                    className="w-full rounded border border-[#E2E8F0] bg-[#FFFFFF] p-2.5 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() => setActiveTab("TIERS_AND_ADDONS")}
              className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#0F172A]"
            >
              ← Back to Tab 2 (Reward Tiers)
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleSave("DRAFT")}
                className="rounded-md border border-[#0F172A] bg-[#FFFFFF] px-4 py-2.5 text-xs font-semibold text-[#0F172A]"
              >
                Save Campaign Draft
              </button>
              <button
                type="button"
                disabled={isPending || kycStatus !== "APPROVED"}
                onClick={() => handleSave("UNDER_REVIEW")}
                className={
                  kycStatus === "APPROVED"
                    ? "rounded-md bg-[#16A34A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#15803D]"
                    : "cursor-not-allowed rounded-md border border-[#E2E8F0] bg-slate-100 px-5 py-2.5 text-xs font-medium text-slate-400"
                }
              >
                {kycStatus === "APPROVED"
                  ? "✓ Submit Campaign for Launch"
                  : "🔒 Complete KYC to Unlock Launch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

