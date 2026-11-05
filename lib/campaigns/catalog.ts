/**
 * @file /lib/campaigns/catalog.ts
 * @description Domain models, strict vertical metadata, and curated seed catalog
 * for Inspirespace Launchpad campaigns, reward tiers, add-ons, and 3-tranche milestones.
 */

import {
  calculateEscrowTrancheSchedule,
  type CampaignEscrowSchedule,
} from "../finance/calculator.ts";

export type CampaignCategoryCode =
  | "HARDWARE_IOT"
  | "GAMES_COMICS"
  | "D2C_ARTISANAL";

export type CampaignLifecycleStatus =
  | "DRAFT"
  | "UNDER_REVIEW"
  | "LIVE"
  | "SUCCESSFUL"
  | "FAILED_REFUNDING"
  | "COMPLETED";

export type ShippingScopeCode = "INDIA_ONLY" | "GLOBAL";

export interface VerticalMetadata {
  code: CampaignCategoryCode;
  label: string;
  shortLabel: string;
  description: string;
  defaultHsnCode: string;
  defaultGstSlab: number;
  prototypeRequirementLabel: string;
}

export const ALLOWED_VERTICALS: ReadonlyArray<VerticalMetadata> = [
  {
    code: "HARDWARE_IOT",
    label: "D2C Hardware, IoT & Consumer Electronics",
    shortLabel: "Hardware & IoT",
    description:
      "Smart devices, mechanical keyboards, audio gear, robotics, and embedded electronics engineered in India.",
    defaultHsnCode: "8517",
    defaultGstSlab: 18,
    prototypeRequirementLabel:
      "Uncut working EVT/DVT prototype video, PCB layout / CAD renders, and factory BOM quotation.",
  },
  {
    code: "GAMES_COMICS",
    label: "Tabletop Games, Comics & Indie Video Games",
    shortLabel: "Tabletop, Comics & Indie Games",
    description:
      "Board games, graphic novels, collector editions, and indie game releases with verified print-run specs.",
    defaultHsnCode: "9504",
    defaultGstSlab: 12,
    prototypeRequirementLabel:
      "Physical tabletop print-and-play sample photos, artwork spreads, or playable vertical slice video.",
  },
  {
    code: "D2C_ARTISANAL",
    label: "D2C Consumer Brands & Artisanal Batch Launches",
    shortLabel: "D2C & Artisanal Batch",
    description:
      "Small-batch specialty coffee gear, heritage craft objects, precision cookware, and functional design goods.",
    defaultHsnCode: "7323",
    defaultGstSlab: 18,
    prototypeRequirementLabel:
      "First-article production sample photos, material lab/food-grade certification, and batch tooling specs.",
  },
] as const;

export interface RewardTierModel {
  id: string;
  title: string;
  description: string;
  pricePaise: bigint; // Stored in integer paise
  hsnCode: string;
  gstPercentage: number; // e.g., 18.00
  earlyBirdLimit: number | null; // null if unlimited
  claimedCount: number;
  itemizedInclusions: string[];
  estimatedDeliveryDate: string; // YYYY-MM-DD
  shippingScope: ShippingScopeCode;
  domesticShippingPaise: bigint;
}

export interface CampaignAddonModel {
  id: string;
  name: string;
  description: string;
  pricePaise: bigint;
  stockLimit: number | null;
  claimedCount: number;
}

export interface PrototypeAndMilestoneProofModel {
  readinessStage: "EVT_PROTOTYPE" | "DVT_VERIFIED" | "PVT_TOOLING_READY";
  prototypePhotoUrls: string[];
  cadOrWorkingVideoUrl: string;
  engineeringSummary: string;
  milestone1Plan: {
    trancheCode: "TRANCHE_1_30_PCT";
    releasePercentage: 30;
    title: string;
    deliverableScope: string;
    verificationArtifactRequired: string;
  };
  milestone2Plan: {
    trancheCode: "TRANCHE_2_40_PCT";
    releasePercentage: 40;
    title: string;
    deliverableScope: string;
    verificationArtifactRequired: string;
  };
  milestone3Plan: {
    trancheCode: "TRANCHE_3_30_PCT";
    releasePercentage: 30;
    title: string;
    deliverableScope: string;
    verificationArtifactRequired: string;
  };
}

export interface CampaignModel {
  id: string;
  creatorId: string;
  creatorLegalName: string;
  creatorLocation: string;
  creatorGstin: string;
  title: string;
  subtitle: string;
  slug: string;
  category: CampaignCategoryCode;
  fundingType: "ALL_OR_NOTHING";
  goalAmountPaise: bigint;
  pledgedAmountPaise: bigint;
  backerCount: number;
  durationDays: number; // 15 to 60 days
  startDateIso: string;
  endDateIso: string;
  status: CampaignLifecycleStatus;
  pitchVideoUrl: string;
  heroImageUrl: string;
  storyMarkdown: string;
  riskDisclosure: string;
  rewardTiers: RewardTierModel[];
  addons: CampaignAddonModel[];
  prototypeAndMilestones: PrototypeAndMilestoneProofModel;
}

// ============================================================================
// CURATED SEED CAMPAIGNS (ACROSS ALL 3 VERTICALS)
// ============================================================================

export const SEED_CAMPAIGNS: CampaignModel[] = [
  {
    id: "cmp_vayu_01",
    creatorId: "usr_creator_01",
    creatorLegalName: "Vayu Precision Hardware Private Limited",
    creatorLocation: "Bengaluru, Karnataka",
    creatorGstin: "29AAACV4821C1Z5",
    title: "Vayu-1: Open-Source Matter & VOC Air Quality Telemetry Station",
    subtitle:
      "CNC-machined anodized aluminum desktop air quality monitor with Sensirion SEN55 Particulate/VOC sensors, E-Ink display, and local Matter-over-Thread telemetry.",
    slug: "vayu-1-open-source-air-quality-telemetry",
    category: "HARDWARE_IOT",
    fundingType: "ALL_OR_NOTHING",
    goalAmountPaise: 250_000_000n, // ₹25,00,000.00
    pledgedAmountPaise: 192_500_000n, // ₹19,25,000.00 (77% funded)
    backerCount: 214,
    durationDays: 45,
    startDateIso: "2026-10-15T00:00:00.000Z",
    endDateIso: "2026-11-29T23:59:59.000Z",
    status: "LIVE",
    pitchVideoUrl: "https://player.vimeo.com/video/vayu1-evt-demo",
    heroImageUrl: "/images/vayu-1-hero.jpg",
    storyMarkdown: `### Engineered for Indian Urban Micro-Climates\n\nVayu-1 was designed in Bengaluru to monitor PM1.0, PM2.5, PM10, TVOC, NOx, CO2 (NDIR), temperature, and humidity without cloud subscriptions or proprietary lock-in.\n\n- **Sensor Core**: Genuine Swiss Sensirion SEN55 + SCD41 True NDIR CO2 module\n- **Enclosure**: Bead-blasted 6061-T6 CNC aluminum chassis\n- **Display**: 4.2-inch Sunlight-readable Carta E-Ink display with 14-day trend graph\n- **Connectivity**: Matter-over-Thread, Home Assistant Native ESPHome firmware, and USB-C PD`,
    riskDisclosure:
      "Sensirion SEN55 optical modules have a 4-week factory lead time from Zurich. We have locked a pro-forma allocation with our authorized distributor in Mumbai for the first 500 units. Enclosure CNC anodizing is performed in Peenya Industrial Area, Bengaluru with a backup vendor in Pune.",
    rewardTiers: [
      {
        id: "tier_vayu_eb",
        title: "Early-Bird Founder Edition (CNC Silver)",
        description:
          "First-batch Vayu-1 Station with laser-etched serial number (001–100) and braided USB-C cable.",
        pricePaise: 799_900n, // ₹7,999.00
        hsnCode: "9027",
        gstPercentage: 18,
        earlyBirdLimit: 100,
        claimedCount: 88,
        itemizedInclusions: [
          "Vayu-1 CNC Aluminum Air Telemetry Unit",
          "Sensirion SEN55 + SCD41 NDIR CO2 Sensor Module (Pre-calibrated)",
          "2m Braided USB-C Cable & Calibration Certificate",
          "Open-Source ESPHome & Matter Firmware Access",
        ],
        estimatedDeliveryDate: "2027-02-15",
        shippingScope: "INDIA_ONLY",
        domesticShippingPaise: 15_000n, // ₹150.00
      },
      {
        id: "tier_vayu_std",
        title: "Standard Pre-Order Batch 1 (Anodized Slate)",
        description:
          "Complete Vayu-1 Air Quality Station in matte Slate Grey or Natural Silver.",
        pricePaise: 899_900n, // ₹8,999.00
        hsnCode: "9027",
        gstPercentage: 18,
        earlyBirdLimit: 250,
        claimedCount: 112,
        itemizedInclusions: [
          "Vayu-1 CNC Aluminum Air Telemetry Unit",
          "Sensirion SEN55 + SCD41 NDIR CO2 Sensor Module",
          "2m Braided USB-C Cable",
          "1-Year Domestic Replacement Warranty",
        ],
        estimatedDeliveryDate: "2027-03-01",
        shippingScope: "INDIA_ONLY",
        domesticShippingPaise: 15_000n,
      },
      {
        id: "tier_vayu_duo",
        title: "Home & Studio Dual Pack (2× Vayu-1 Units)",
        description:
          "Monitor both bedroom and workspace air quality with multi-room Home Assistant mesh sync.",
        pricePaise: 1_699_900n, // ₹16,999.00
        hsnCode: "9027",
        gstPercentage: 18,
        earlyBirdLimit: 50,
        claimedCount: 14,
        itemizedInclusions: [
          "2× Vayu-1 CNC Aluminum Air Telemetry Units",
          "2× Sensirion SEN55 + SCD41 NDIR Sensor Modules",
          "2× Magnetic Desk Stands + Wall Mount Brackets",
          "Free Insured Express Shipping across India",
        ],
        estimatedDeliveryDate: "2027-03-01",
        shippingScope: "INDIA_ONLY",
        domesticShippingPaise: 0n,
      },
    ],
    addons: [
      {
        id: "add_vayu_stand",
        name: "Machined Brass 15° Angled Desk Stand",
        description:
          "Heavyweight solid C36000 brass desk cradle with silicone isolation pads.",
        pricePaise: 129_900n, // ₹1,299.00
        stockLimit: 150,
        claimedCount: 64,
      },
      {
        id: "add_vayu_sen55",
        name: "Spare Sensirion SEN55 Replacement Cartridge",
        description:
          "Hot-swappable plug-and-play sensor module for 3+ year maintenance.",
        pricePaise: 249_900n, // ₹2,499.00
        stockLimit: 100,
        claimedCount: 29,
      },
    ],
    prototypeAndMilestones: {
      readinessStage: "DVT_VERIFIED",
      prototypePhotoUrls: [
        "EVT3_4Layer_ImmersionGold_PCB_Top.jpg",
        "CNC_6061_Enclosure_FirstArticle_Inspection.jpg",
        "Anechoic_Thermal_Chamber_Calibration_Log.pdf",
      ],
      cadOrWorkingVideoUrl: "https://vimeo.com/inspirespace/vayu1-uncut-dvt",
      engineeringSummary:
        "12 DVT units have been running 24/7 for 45 days in Bengaluru and Delhi NCR. 4-layer ENIG PCBs are panelized and verified with LionCircuits.",
      milestone1Plan: {
        trancheCode: "TRANCHE_1_30_PCT",
        releasePercentage: 30,
        title: "Campaign Success & BOM Component Procurement (30%)",
        deliverableScope:
          "Place firm PO for 400× Sensirion SEN55 + SCD41 sensor reels, ESP32-C6 modules, and 6061 aluminum billets.",
        verificationArtifactRequired:
          "Signed vendor tax invoices & SWIFT/NEFT remittance receipts for sensor and PCB fabrication orders.",
      },
      milestone2Plan: {
        trancheCode: "TRANCHE_2_40_PCT",
        releasePercentage: 40,
        title: "SMT PCB Assembly & CNC Enclosure Batch Run (40%)",
        deliverableScope:
          "Complete SMT pick-and-place assembly, CNC machining, anodizing, and 24-hour burn-in calibration of all batch units.",
        verificationArtifactRequired:
          "Factory SMT QA pass certificates, timestamped assembly line video, and serial-numbered calibration logs.",
      },
      milestone3Plan: {
        trancheCode: "TRANCHE_3_30_PCT",
        releasePercentage: 30,
        title: "Final Packaging & Backer Courier Dispatch (30%)",
        deliverableScope:
          "Custom molded pulp packaging, GST tax invoice generation, and handover to BlueDart / Delhivery with AWB tracking.",
        verificationArtifactRequired:
          "Verified logistics manifest with live AWB tracking numbers for >=95% of domestic backer pledges.",
      },
    },
  },
  {
    id: "cmp_deccan_02",
    creatorId: "usr_creator_02",
    creatorLegalName: "Deccan Guild Tabletop & Interactive LLP",
    creatorLocation: "Pune, Maharashtra",
    creatorGstin: "27AAAFD8821F1Z9",
    title: "Monsoon Kingdoms: Asymmetric Strategy Board Game & Graphic Lore",
    subtitle:
      "A 1–4 player euro-strategy tabletop game of maritime trade, fort architecture, and monsoon navigation across 16th-century Peninsular India.",
    slug: "monsoon-kingdoms-tabletop-strategy-game",
    category: "GAMES_COMICS",
    fundingType: "ALL_OR_NOTHING",
    goalAmountPaise: 120_000_000n, // ₹12,00,000.00
    pledgedAmountPaise: 138_400_000n, // ₹13,84,000.00 (115% funded)
    backerCount: 392,
    durationDays: 30,
    startDateIso: "2026-10-20T00:00:00.000Z",
    endDateIso: "2026-11-19T23:59:59.000Z",
    status: "LIVE",
    pitchVideoUrl: "https://player.vimeo.com/video/monsoon-kingdoms-playthrough",
    heroImageUrl: "/images/monsoon-kingdoms-hero.jpg",
    storyMarkdown: `### Built with Indian Illustrators & Heavyweight Linen Components\n\nMonsoon Kingdoms blends historical archival cartography with deep resource-wheel mechanics. Every box is printed in Mumbai on 350 GSM German black-core card stock with screen-printed beechwood ship meeples.`,
    riskDisclosure:
      "All 140 card illustrations and wooden die-cut molds are finalized. Print proofs have been approved with Parksons Graphics (Mumbai).",
    rewardTiers: [
      {
        id: "tier_mk_core",
        title: "Core Box Pre-Order (First Printing)",
        description:
          "Complete Monsoon Kingdoms Core Game with 96 wooden tokens, dual-layer player boards, and rulebook.",
        pricePaise: 329_900n, // ₹3,299.00
        hsnCode: "9504",
        gstPercentage: 12,
        earlyBirdLimit: 200,
        claimedCount: 184,
        itemizedInclusions: [
          "Folded 60×90cm Linen-Finish Peninsular Map Board",
          "4× Dual-Layer Faction Boards",
          "96× Screen-Printed Wooden Ships & Fortresses",
          "140× 350 GSM Black-Core Tariff & Monsoon Cards",
        ],
        estimatedDeliveryDate: "2027-01-25",
        shippingScope: "INDIA_ONLY",
        domesticShippingPaise: 12_000n,
      },
    ],
    addons: [
      {
        id: "add_mk_coins",
        name: "Set of 45 Antique-Finish Zinc Alloy Pagoda Coins",
        description:
          "Custom-minted 3mm thick metal currency tokens replacing cardboard coins.",
        pricePaise: 89_900n, // ₹899.00
        stockLimit: 300,
        claimedCount: 145,
      },
    ],
    prototypeAndMilestones: {
      readinessStage: "PVT_TOOLING_READY",
      prototypePhotoUrls: [
        "Parksons_Mumbai_WetProof_Sheet1.jpg",
        "Beechwood_Meeple_LaserDie_Sample.jpg",
      ],
      cadOrWorkingVideoUrl: "https://vimeo.com/inspirespace/monsoon-kingdoms-2p",
      engineeringSummary:
        "Pre-press PDF/X-4 files and wooden token CNC dies are signed off.",
      milestone1Plan: {
        trancheCode: "TRANCHE_1_30_PCT",
        releasePercentage: 30,
        title: "Paper Stock & Die-Cut Tooling Deposit (30%)",
        deliverableScope:
          "Procure 350 GSM black-core cardstock, greyboard, and steel rule die-cut plates.",
        verificationArtifactRequired:
          "Printer purchase order and paper mill delivery challan.",
      },
      milestone2Plan: {
        trancheCode: "TRANCHE_2_40_PCT",
        releasePercentage: 40,
        title: "Offset Print Run & Box Collation (40%)",
        deliverableScope:
          "Complete 4-color offset printing, linen embossing, wooden token packing, and shrink-wrapping of 1,000 units.",
        verificationArtifactRequired:
          "Press-check photos and warehouse pallet QC count sheet.",
      },
      milestone3Plan: {
        trancheCode: "TRANCHE_3_30_PCT",
        releasePercentage: 30,
        title: "Corner-Protected Fulfillment Dispatch (30%)",
        deliverableScope:
          "Pack in 5-ply edge-protected mailers and dispatch to all backers via Delhivery.",
        verificationArtifactRequired:
          "Courier pickup manifest and backer AWB tracking batch upload.",
      },
    },
  },
  {
    id: "cmp_kaapi_03",
    creatorId: "usr_creator_03",
    creatorLegalName: "Malnad Craft & Precision Works (OPC) Private Limited",
    creatorLocation: "Chikkamagaluru, Karnataka",
    creatorGstin: "29AAACM9912C1Z1",
    title: "Kaveri-9: Solid Brass & Teak Direct-Lever Espresso Press",
    subtitle:
      "Zero-plastic, manual 9-bar direct-lever espresso maker machined from lead-free food-grade brass and seasoned Nilambur teak.",
    slug: "kaveri-9-brass-direct-lever-espresso-press",
    category: "D2C_ARTISANAL",
    fundingType: "ALL_OR_NOTHING",
    goalAmountPaise: 180_000_000n, // ₹18,00,000.00
    pledgedAmountPaise: 165_600_000n, // ₹16,56,000.00 (92% funded)
    backerCount: 115,
    durationDays: 35,
    startDateIso: "2026-10-18T00:00:00.000Z",
    endDateIso: "2026-11-22T23:59:59.000Z",
    status: "LIVE",
    pitchVideoUrl: "https://player.vimeo.com/video/kaveri9-extraction-pull",
    heroImageUrl: "/images/kaveri-9-hero.jpg",
    storyMarkdown: `### Heirloom Coffee Engineering from Karnataka\n\nKaveri-9 combines a 58mm commercial stainless steel grouphead with a CNC-turned brass piston and liquid-filled pressure gauge for café-grade 9-bar espresso without electronics.`,
    riskDisclosure:
      "Lead-free brass billets are sourced from Jamnagar with NABL metallurgical test reports verifying 0.00% lead content.",
    rewardTiers: [
      {
        id: "tier_kav_batch1",
        title: "Batch-001 Numbered Craftsman Edition",
        description:
          "Kaveri-9 Lever Press with 58mm naked portafilter, stainless tamper, and Chikkamagaluru estate coffee sampler.",
        pricePaise: 1_440_000n, // ₹14,400.00
        hsnCode: "7323",
        gstPercentage: 18,
        earlyBirdLimit: 120,
        claimedCount: 115,
        itemizedInclusions: [
          "Kaveri-9 Direct-Lever Press (Food-Grade Brass & SS304 Piston)",
          "58mm Bottomless Portafilter with Nilambur Teak Handle",
          "Glycerin-Filled 0–16 Bar Pressure Gauge",
          "58.5mm Calibrated Stainless Steel Tamper",
        ],
        estimatedDeliveryDate: "2027-02-10",
        shippingScope: "INDIA_ONLY",
        domesticShippingPaise: 0n,
      },
    ],
    addons: [],
    prototypeAndMilestones: {
      readinessStage: "DVT_VERIFIED",
      prototypePhotoUrls: [
        "NABL_FoodGrade_Metallurgy_Certificate.pdf",
        "Hydrostatic_16Bar_Seal_Test_Rig.jpg",
      ],
      cadOrWorkingVideoUrl: "https://vimeo.com/inspirespace/kaveri9-9bar-pull",
      engineeringSummary:
        "Tested across 2,500 consecutive thermal-shock pulls at 95°C and 12 bar peak pressure.",
      milestone1Plan: {
        trancheCode: "TRANCHE_1_30_PCT",
        releasePercentage: 30,
        title: "SS304 & Brass Billet Sourcing (30%)",
        deliverableScope:
          "Purchase certified SS304 bar stock, Viton food-grade O-rings, and pressure gauges.",
        verificationArtifactRequired:
          "Metal mill test certificates (MTC) and supplier tax invoices.",
      },
      milestone2Plan: {
        trancheCode: "TRANCHE_2_40_PCT",
        releasePercentage: 40,
        title: "5-Axis CNC Turning & Hydrostatic Pressure QA (40%)",
        deliverableScope:
          "Machine all 120 brew chambers, wood-turn teak handles, and pressure-test every unit to 14 bar.",
        verificationArtifactRequired:
          "Batch hydrostatic test log and QC inspection photos.",
      },
      milestone3Plan: {
        trancheCode: "TRANCHE_3_30_PCT",
        releasePercentage: 30,
        title: "Custom Foam Crating & Insured Dispatch (30%)",
        deliverableScope:
          "Pack in precision-cut EPE foam crates and ship via insured surface/air courier.",
        verificationArtifactRequired:
          "Courier AWB numbers and backer dispatch confirmation.",
      },
    },
  },
];

// ============================================================================
// CATALOG QUERY & CALCULATION HELPERS
// ============================================================================

export function findCampaignBySlug(slug: string): CampaignModel | undefined {
  return SEED_CAMPAIGNS.find((c) => c.slug === slug);
}

export function findCampaignById(id: string): CampaignModel | undefined {
  return SEED_CAMPAIGNS.find((c) => c.id === id);
}

export function computeCampaignProgressMetrics(campaign: CampaignModel): {
  percentFunded: number;
  daysLeft: number;
  escrowSchedule: CampaignEscrowSchedule;
} {
  const percentFunded =
    campaign.goalAmountPaise > 0n
      ? Number((campaign.pledgedAmountPaise * 100n) / campaign.goalAmountPaise)
      : 0;

  const nowMs = new Date("2026-11-05T18:25:00+05:30").getTime();
  const endMs = new Date(campaign.endDateIso).getTime();
  const diffDays = Math.ceil((endMs - nowMs) / (1000 * 60 * 60 * 24));
  const daysLeft = Math.max(0, diffDays);

  // Compute the 30% / 40% / 30% tranche schedule on the higher of pledged or goal amount
  const baseForSchedule =
    campaign.pledgedAmountPaise >= campaign.goalAmountPaise
      ? campaign.pledgedAmountPaise
      : campaign.goalAmountPaise;

  const escrowSchedule = calculateEscrowTrancheSchedule(baseForSchedule, {
    tdsTcsRateBps: 0n,
  });

  return {
    percentFunded,
    daysLeft,
    escrowSchedule,
  };
}
