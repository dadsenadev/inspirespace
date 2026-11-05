/**
 * @file /lib/services/razorpay-route.ts
 * @description Razorpay Route API (`POST /v2/accounts`) integration for creating
 * Creator Linked Accounts for milestone-gated escrow transfers (30% / 40% / 30%).
 */

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creatorKyc } from "@/lib/db/schema";
import type { KycEntityType } from "./kyc-service";

export type RazorpayBusinessType =
  | "individual"
  | "proprietorship"
  | "private_limited"
  | "llp";

export interface CreateLinkedAccountInput {
  userId: string;
  email: string;
  phone: string;
  legalBusinessName: string;
  entityType: KycEntityType;
  panNumber: string;
  gstin?: string | null;
  cinNumber?: string | null;
  bankAccountNumber: string;
  bankIfsc: string;
  beneficiaryName: string;
}

export interface RazorpayLinkedAccountResponse {
  success: boolean;
  razorpayLinkedAccountId: string; // e.g., "acc_P9kRzpEscrow01"
  status: "created" | "activated" | "under_review";
  referenceId: string;
  mode: "LIVE_API" | "SANDBOX";
  errorMessage?: string;
}

/**
 * Maps internal `entity_type` enum to Razorpay Route v2 `business_type`.
 */
export function mapEntityTypeToRazorpayBusinessType(
  entityType: KycEntityType
): RazorpayBusinessType {
  switch (entityType) {
    case "INDIVIDUAL":
      return "individual";
    case "PROPRIETORSHIP":
      return "proprietorship";
    case "PVT_LTD":
    case "OPC":
      return "private_limited";
    case "LLP":
      return "llp";
  }
}

/**
 * Calls Razorpay Route API (`POST /v2/accounts`) to create a Linked Account
 * for escrow tranche disbursements.
 * Automatically uses deterministic sandbox provisioning if Razorpay credentials
 * are not configured or use placeholder values.
 */
export async function createRazorpayLinkedAccount(
  input: CreateLinkedAccountInput
): Promise<RazorpayLinkedAccountResponse> {
  const keyId = process.env.RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const isPlaceholder =
    !keyId ||
    !keySecret ||
    keyId.includes("xxxxxxxx") ||
    keySecret.includes("xxxxxxxx");

  const referenceId = `insp_creator_${input.userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16)}`;

  // 1. Sandbox Mode for Local Development & Testing
  if (isPlaceholder) {
    const deterministicSuffix = input.panNumber
      .toUpperCase()
      .slice(0, 6)
      .concat(input.bankIfsc.slice(-4).toUpperCase());
    const linkedAccountId = `acc_RzpRoute_${deterministicSuffix}`;

    return {
      success: true,
      razorpayLinkedAccountId: linkedAccountId,
      status: "activated",
      referenceId,
      mode: "SANDBOX",
    };
  }

  // 2. Live / Razorpay Test API Call (`POST https://api.razorpay.com/v2/accounts`)
  const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const businessType = mapEntityTypeToRazorpayBusinessType(input.entityType);

  const payload = {
    email: input.email,
    phone: input.phone.replace(/[^0-9]/g, "").slice(-10),
    type: "route",
    reference_id: referenceId,
    legal_business_name: input.legalBusinessName.trim(),
    business_type: businessType,
    contact_name: input.beneficiaryName.trim(),
    profile: {
      category: "ecommerce",
      subcategory: "crowdfunding_launchpad_creator",
      addresses: {
        registered: {
          street1: "Registered Creator Premises",
          street2: "India",
          city: "Bengaluru",
          state: "KARNATAKA",
          postal_code: "560001",
          country: "IN",
        },
      },
    },
    legal_info: {
      pan: input.panNumber.trim().toUpperCase(),
      ...(input.gstin ? { gst: input.gstin.trim().toUpperCase() } : {}),
      ...(input.cinNumber ? { cin: input.cinNumber.trim().toUpperCase() } : {}),
    },
    notes: {
      platform: "Inspirespace Launchpad OPC Pvt Ltd",
      escrow_model: "30_40_30_MILESTONE_TRANCHES",
      bank_ifsc: input.bankIfsc.trim().toUpperCase(),
    },
  };

  try {
    const response = await fetch("https://api.razorpay.com/v2/accounts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${authHeader}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json()) as {
      id?: string;
      status?: "created" | "activated" | "under_review";
      reference_id?: string;
      error?: { description?: string; code?: string };
    };

    if (!response.ok || !data.id) {
      return {
        success: false,
        razorpayLinkedAccountId: "",
        status: "under_review",
        referenceId,
        mode: "LIVE_API",
        errorMessage:
          data.error?.description ??
          `Razorpay Route API failed with HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      razorpayLinkedAccountId: data.id,
      status: data.status ?? "created",
      referenceId: data.reference_id ?? referenceId,
      mode: "LIVE_API",
    };
  } catch (error) {
    return {
      success: false,
      razorpayLinkedAccountId: "",
      status: "under_review",
      referenceId,
      mode: "LIVE_API",
      errorMessage:
        error instanceof Error
          ? error.message
          : "Network failure while connecting to Razorpay Route v2 API",
    };
  }
}

/**
 * Creates a Razorpay Linked Account and atomically updates `creator_kyc`
 * with `razorpay_linked_account_id`, `kyc_status = 'APPROVED'`, and `verified_at`.
 */
export async function provisionAndApproveCreatorRouteAccount(
  input: CreateLinkedAccountInput
): Promise<RazorpayLinkedAccountResponse> {
  const routeResult = await createRazorpayLinkedAccount(input);

  if (!routeResult.success || !routeResult.razorpayLinkedAccountId) {
    return routeResult;
  }

  // Persist to PostgreSQL `creator_kyc` when DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    await db
      .update(creatorKyc)
      .set({
        razorpayLinkedAccountId: routeResult.razorpayLinkedAccountId,
        kycStatus: "APPROVED",
        verifiedAt: new Date(),
      })
      .where(eq(creatorKyc.userId, input.userId));
  }

  return routeResult;
}

