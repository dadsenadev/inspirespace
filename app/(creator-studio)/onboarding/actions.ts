"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creatorKyc } from "@/lib/db/schema";
import {
  getKycVerificationService,
  PAN_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  CIN_OR_LLPIN_REGEX,
  doesGstinMatchPan,
  type KycEntityType,
  type PanVerificationResult,
  type GstinVerificationResult,
  type IfscLookupResult,
  type PennyDropVerificationResult,
} from "@/lib/services/kyc-service";
import {
  provisionAndApproveCreatorRouteAccount,
  type RazorpayLinkedAccountResponse,
} from "@/lib/services/razorpay-route";

// ============================================================================
// STEP PAYLOAD & RESPONSE CONTRACTS
// ============================================================================

export interface Step1IdentityPayload {
  userId: string;
  legalName: string;
  entityType: KycEntityType;
  panNumber: string;
  cinNumber?: string;
  identityDocumentName: string;
  identityDocumentType: "AADHAAR_MASKED_PDF" | "INCORPORATION_CERTIFICATE";
}

export interface Step1ActionResponse {
  success: boolean;
  error?: string;
  panVerification?: PanVerificationResult;
}

export interface Step2TaxCompliancePayload {
  userId: string;
  entityType: KycEntityType;
  panNumber: string;
  isGstRegistered: boolean;
  gstin?: string;
  nonGstMicroCreatorDeclaration: boolean;
  acceptedIntermediaryAndEscrowTerms: boolean;
}

export interface Step2ActionResponse {
  success: boolean;
  error?: string;
  gstinVerification?: GstinVerificationResult;
}

export interface Step3BankAndRoutePayload {
  userId: string;
  email: string;
  phone: string;
  legalName: string;
  entityType: KycEntityType;
  panNumber: string;
  cinNumber?: string;
  gstin?: string;
  accountHolderName: string;
  bankAccountNumber: string;
  confirmBankAccountNumber: string;
  bankIfsc: string;
}

export interface Step3ActionResponse {
  success: boolean;
  error?: string;
  ifscDetails?: IfscLookupResult;
  pennyDropResult?: PennyDropVerificationResult;
  razorpayRouteResult?: RazorpayLinkedAccountResponse;
  kycStatus?: "DRAFT" | "PENDING_VERIFICATION" | "APPROVED" | "REJECTED";
  verifiedAtIso?: string;
}

// ============================================================================
// STEP 1 ACTION: ENTITY & PAN VERIFICATION
// ============================================================================

export async function verifyAndSaveStep1Action(
  payload: Step1IdentityPayload
): Promise<Step1ActionResponse> {
  const legalName = payload.legalName.trim();
  const panNumber = payload.panNumber.trim().toUpperCase();
  const cinNumber = payload.cinNumber?.trim().toUpperCase() ?? "";
  const isCorporate =
    payload.entityType === "PVT_LTD" ||
    payload.entityType === "OPC" ||
    payload.entityType === "LLP";

  if (legalName.length < 3) {
    return {
      success: false,
      error: "Legal Name must be at least 3 characters long as per PAN card.",
    };
  }

  if (!PAN_REGEX.test(panNumber)) {
    return {
      success: false,
      error:
        "Invalid PAN Number format. Expected 10 characters matching ^[A-Z]{5}[0-9]{4}[A-Z]{1}$ (e.g., AAACI1234C).",
    };
  }

  if (isCorporate && !CIN_OR_LLPIN_REGEX.test(cinNumber)) {
    return {
      success: false,
      error:
        "Corporate entities (PVT_LTD, OPC, LLP) must provide a valid 21-character MCA CIN or 8-character LLPIN.",
    };
  }

  if (!payload.identityDocumentName.trim()) {
    return {
      success: false,
      error: isCorporate
        ? "Please upload your MCA Certificate of Incorporation (COI)."
        : "Please upload your Masked Aadhaar e-KYC PDF or Proprietor Identity Proof.",
    };
  }

  const kycService = getKycVerificationService();
  const panResult = await kycService.verifyPan(
    panNumber,
    legalName,
    payload.entityType
  );

  if (!panResult.verified) {
    return {
      success: false,
      error:
        panResult.errorMessage ??
        "PAN verification failed against NSDL records.",
      panVerification: panResult,
    };
  }

  return {
    success: true,
    panVerification: panResult,
  };
}

// ============================================================================
// STEP 2 ACTION: GSTIN & INTERMEDIARY ESCROW AGREEMENT VERIFICATION
// ============================================================================

export async function verifyAndSaveStep2Action(
  payload: Step2TaxCompliancePayload
): Promise<Step2ActionResponse> {
  const panNumber = payload.panNumber.trim().toUpperCase();
  const gstin = payload.gstin?.trim().toUpperCase() ?? "";
  const isCorporate =
    payload.entityType === "PVT_LTD" ||
    payload.entityType === "OPC" ||
    payload.entityType === "LLP";

  if (!payload.acceptedIntermediaryAndEscrowTerms) {
    return {
      success: false,
      error:
        "You must accept the OPC Pvt Ltd Intermediary Terms & 3-Tranche (30% / 40% / 30%) Milestone Escrow Agreement.",
    };
  }

  // Corporate entities MUST provide GSTIN (matches PostgreSQL chk_creator_kyc_commercial_mandatory_fields)
  if (isCorporate && (!payload.isGstRegistered || !gstin)) {
    return {
      success: false,
      error:
        "Registered corporate entities (PVT_LTD, OPC, LLP) and commercial D2C brands must provide an active 15-character GSTIN.",
    };
  }

  if (payload.isGstRegistered) {
    if (!GSTIN_REGEX.test(gstin)) {
      return {
        success: false,
        error:
          "Invalid GSTIN format. Must match ^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$.",
      };
    }

    if (!doesGstinMatchPan(gstin, panNumber)) {
      return {
        success: false,
        error: `GSTIN mismatch: characters 3–12 of GSTIN (${gstin.slice(
          2,
          12
        )}) do not match your verified Step 1 PAN (${panNumber}).`,
      };
    }

    const kycService = getKycVerificationService();
    const gstResult = await kycService.verifyGstin(gstin, panNumber);

    if (!gstResult.verified) {
      return {
        success: false,
        error:
          gstResult.errorMessage ??
          "GSTIN could not be verified as ACTIVE on the GSTN portal.",
        gstinVerification: gstResult,
      };
    }

    return {
      success: true,
      gstinVerification: gstResult,
    };
  }

  // Non-GST Micro-Creator path (only INDIVIDUAL / PROPRIETORSHIP)
  if (!payload.nonGstMicroCreatorDeclaration) {
    return {
      success: false,
      error:
        "Unregistered micro-creators must sign the Section 22 CGST Act threshold exemption declaration.",
    };
  }

  return {
    success: true,
  };
}

// ============================================================================
// IFSC LIVE BRANCH LOOKUP ACTION
// ============================================================================

export async function lookupIfscBranchAction(
  ifsc: string
): Promise<IfscLookupResult> {
  const kycService = getKycVerificationService();
  return kycService.verifyIfsc(ifsc);
}

// ============================================================================
// STEP 3 ACTION: PENNY-DROP BAV + RAZORPAY ROUTE LINKED ACCOUNT PROVISIONING
// ============================================================================

export async function verifyBankAndProvisionRouteAction(
  payload: Step3BankAndRoutePayload
): Promise<Step3ActionResponse> {
  const accountNumber = payload.bankAccountNumber.trim();
  const confirmAccountNumber = payload.confirmBankAccountNumber.trim();
  const bankIfsc = payload.bankIfsc.trim().toUpperCase();
  const holderName = payload.accountHolderName.trim();

  if (holderName.length < 3) {
    return {
      success: false,
      error: "Account Holder Name is required for Penny-Drop verification.",
    };
  }

  if (accountNumber !== confirmAccountNumber) {
    return {
      success: false,
      error: "Bank Account Number and Confirm Account Number do not match.",
    };
  }

  if (!IFSC_REGEX.test(bankIfsc)) {
    return {
      success: false,
      error:
        "Invalid IFSC Code. Must be 11 characters with '0' as the 5th character (e.g., HDFC0000123).",
    };
  }

  const kycService = getKycVerificationService();

  // 1. Verify IFSC Branch capabilities
  const ifscDetails = await kycService.verifyIfsc(bankIfsc);
  if (!ifscDetails.valid) {
    return {
      success: false,
      error: ifscDetails.errorMessage ?? "Invalid bank IFSC code.",
      ifscDetails,
    };
  }

  // 2. Execute IMPS Penny-Drop Bank Account Verification (₹1.00 credit test)
  const pennyDropResult = await kycService.verifyBankPennyDrop({
    accountHolderName: holderName,
    bankAccountNumber: accountNumber,
    bankIfsc,
  });

  if (!pennyDropResult.verified) {
    return {
      success: false,
      error:
        pennyDropResult.errorMessage ??
        "Penny-drop verification failed. Please ensure the account is active and matches your legal entity name.",
      ifscDetails,
      pennyDropResult,
      kycStatus: "REJECTED",
    };
  }

  // 3. Upsert `creator_kyc` as PENDING_VERIFICATION when DATABASE_URL is configured
  if (process.env.DATABASE_URL) {
    try {
      const existing = await db
        .select({ id: creatorKyc.id })
        .from(creatorKyc)
        .where(eq(creatorKyc.userId, payload.userId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(creatorKyc)
          .set({
            entityType: payload.entityType,
            legalName: payload.legalName.trim(),
            panNumber: payload.panNumber.trim().toUpperCase(),
            gstin: payload.gstin ? payload.gstin.trim().toUpperCase() : null,
            cinNumber: payload.cinNumber
              ? payload.cinNumber.trim().toUpperCase()
              : null,
            bankAccountNumber: accountNumber,
            bankIfsc,
            kycStatus: "PENDING_VERIFICATION",
          })
          .where(eq(creatorKyc.userId, payload.userId));
      } else {
        await db.insert(creatorKyc).values({
          userId: payload.userId,
          entityType: payload.entityType,
          legalName: payload.legalName.trim(),
          panNumber: payload.panNumber.trim().toUpperCase(),
          gstin: payload.gstin ? payload.gstin.trim().toUpperCase() : null,
          cinNumber: payload.cinNumber
            ? payload.cinNumber.trim().toUpperCase()
            : null,
          bankAccountNumber: accountNumber,
          bankIfsc,
          kycStatus: "PENDING_VERIFICATION",
        });
      }
    } catch {
      // Continues in local dev preview if database isn't seeded with the mock user yet
    }
  }

  // 4. Programmatically provision Razorpay Route Linked Account (`POST /v2/accounts`)
  // and transition `creator_kyc.kyc_status` -> 'APPROVED'
  const razorpayRouteResult = await provisionAndApproveCreatorRouteAccount({
    userId: payload.userId,
    email: payload.email,
    phone: payload.phone,
    legalBusinessName: payload.legalName,
    entityType: payload.entityType,
    panNumber: payload.panNumber,
    gstin: payload.gstin ?? null,
    cinNumber: payload.cinNumber ?? null,
    bankAccountNumber: accountNumber,
    bankIfsc,
    beneficiaryName: holderName,
  });

  if (!razorpayRouteResult.success) {
    return {
      success: false,
      error:
        razorpayRouteResult.errorMessage ??
        "Razorpay Route Linked Account creation failed.",
      ifscDetails,
      pennyDropResult,
      razorpayRouteResult,
      kycStatus: "PENDING_VERIFICATION",
    };
  }

  return {
    success: true,
    ifscDetails,
    pennyDropResult,
    razorpayRouteResult,
    kycStatus: "APPROVED",
    verifiedAtIso: new Date().toISOString(),
  };
}

