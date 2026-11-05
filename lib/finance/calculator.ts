/**
 * @file /lib/finance/calculator.ts
 * @description Bank-grade integer-paise financial calculation engine & double-entry
 * ledger generator for Inspirespace Launchpad (India OPC Pvt Ltd intermediary).
 *
 * Key Guarantees:
 * 1. All monetary values are represented strictly in integer Paise (`bigint`, 1 INR = 100 Paise).
 * 2. Zero IEEE-754 floating-point arithmetic is used in fee, tax, or tranche splits.
 * 3. Deterministic Half-Up Integer Rounding (`divideRoundHalfUp`) for individual tax/fee lines.
 * 4. Final-tranche (`TRANCHE_3_30_PCT`) residual absorption ensures ZERO rounding drift both:
 *    - Horizontally (within each tranche: `net = gross - fee - gst - tds_tcs`)
 *    - Vertically (across all 3 tranches: `sum(tranches) === campaignTotal` for every column).
 */

export type TrancheCode =
  | "TRANCHE_1_30_PCT"
  | "TRANCHE_2_40_PCT"
  | "TRANCHE_3_30_PCT";

export interface TaxDeductionOptions {
  /**
   * Basis points (1 bps = 0.01%) for statutory withholding (e.g., Income Tax Act Sec 194-O TDS
   * + CGST Sec 52 TCS where applicable). Default is 0n bps unless specified.
   * Example: 10n bps = 0.10%, 60n bps = 0.60% (0.1% TDS + 0.5% TCS), 100n bps = 1.00%.
   */
  tdsTcsRateBps?: bigint;
}

export interface TrancheBreakdown {
  trancheNumber: TrancheCode;
  allocationBasisPoints: bigint; // 3000n (30%), 4000n (40%), 3000n (30%)
  grossAmountPaise: bigint;
  platformFeePaise: bigint; // 5% of gross
  gstOnFeePaise: bigint; // 18% on the 5% platform fee (0.9% effective of gross)
  tdsTcsDeductedPaise: bigint;
  netPayoutPaise: bigint;
}

export interface CampaignEscrowSchedule {
  totalGrossAmountPaise: bigint;
  totalPlatformFeePaise: bigint;
  totalGstOnFeePaise: bigint;
  totalTdsTcsDeductedPaise: bigint;
  totalNetPayoutPaise: bigint;
  tranches: readonly [TrancheBreakdown, TrancheBreakdown, TrancheBreakdown];
}

export interface PledgeCheckoutBreakdown {
  baseAmountPaise: bigint;
  addonsAmountPaise: bigint;
  shippingAmountPaise: bigint;
  totalPaidPaise: bigint;
  embeddedRewardGstPaise: bigint;
  netPreTaxRewardPaise: bigint;
}

export interface DoubleEntryLedgerLine {
  referenceType:
    | "PLEDGE_CAPTURE"
    | "PLEDGE_REFUND"
    | "TRANCHE_DISBURSEMENT"
    | "PLATFORM_COMMISSION_RECOGNITION"
    | "GST_LIABILITY_RECOGNITION"
    | "TDS_TCS_WITHHOLDING"
    | "ESCROW_ADJUSTMENT";
  referenceId: string;
  debitAccount: string;
  creditAccount: string;
  amountPaise: bigint;
  metadataJson: Record<string, unknown>;
}

// ============================================================================
// STATUTORY & PLATFORM CONSTANTS (BASIS POINTS: 10,000 BPS = 100.00%)
// ============================================================================

export const BPS_SCALE = 10_000n;

/** 5.00% Platform Commission = 500 bps */
export const PLATFORM_COMMISSION_BPS = 500n;

/** 18.00% IGST / CGST+SGST on Platform Commission Service (SAC 998599) = 1800 bps */
export const GST_ON_COMMISSION_BPS = 1_800n;

/** Milestone Escrow Tranche Weights in Basis Points (30% / 40% / 30%) */
export const TRANCHE_1_WEIGHT_BPS = 3_000n;
export const TRANCHE_2_WEIGHT_BPS = 4_000n;
export const TRANCHE_3_WEIGHT_BPS = 3_000n;

/** Standard Chart of Accounts (CoA) Codes for Double-Entry Ledger */
export const LEDGER_ACCOUNTS = {
  GATEWAY_ESCROW_RECEIVABLE: "GATEWAY_ESCROW_RECEIVABLE",
  CAMPAIGN_ESCROW_LIABILITY: "CAMPAIGN_ESCROW_LIABILITY",
  RAZORPAY_NODAL_CLEARING: "ASSET:RAZORPAY_NODAL_CLEARING",
  ESCROW_TRUST_BANK: "ASSET:ESCROW_TRUST_BANK",
  BACKER_ESCROW_LIABILITY: "LIABILITY:BACKER_ESCROW_PAYABLE",
  CREATOR_PAYABLE: "LIABILITY:CREATOR_SETTLEMENT_PAYABLE",
  GST_OUTPUT_PAYABLE: "LIABILITY:GST_OUTPUT_TAX_PAYABLE",
  TDS_TCS_STATUTORY_PAYABLE: "LIABILITY:STATUTORY_TDS_TCS_PAYABLE",
  PLATFORM_COMMISSION_REVENUE: "REVENUE:PLATFORM_COMMISSION_5PCT",
  CREATOR_BANK_SETTLEMENT: "EXPENSE_SETTLEMENT:CREATOR_PAYOUT_DISBURSED",
  BACKER_REFUND_CLEARING: "EXPENSE_SETTLEMENT:BACKER_REFUND_DISBURSED",
} as const;

// ============================================================================
// CORE INTEGER ARITHMETIC PRIMITIVES
// ============================================================================

/**
 * Validates that an input is a non-negative integer `bigint`.
 */
export function assertNonNegativePaise(value: bigint, label: string): void {
  if (typeof value !== "bigint") {
    throw new TypeError(`${label} must be a bigint in paise.`);
  }
  if (value < 0n) {
    throw new RangeError(
      `${label} cannot be negative (received ${value.toString()} paise).`
    );
  }
}

/**
 * Validates that an input is a strictly positive integer `bigint` (> 0n).
 */
export function assertPositivePaise(value: bigint, label: string): void {
  assertNonNegativePaise(value, label);
  if (value === 0n) {
    throw new RangeError(`${label} must be strictly greater than 0 paise.`);
  }
}

/**
 * Performs exact integer division with commercial Half-Up rounding:
 * `round(numerator / denominator)` using pure `bigint` math.
 */
export function divideRoundHalfUp(
  numerator: bigint,
  denominator: bigint
): bigint {
  if (denominator <= 0n) {
    throw new RangeError("Denominator must be a positive bigint.");
  }
  if (numerator < 0n) {
    throw new RangeError("Numerator must be a non-negative bigint.");
  }
  return (numerator + denominator / 2n) / denominator;
}

/**
 * Computes exact basis-point percentage in integer paise using Half-Up rounding.
 * `round((amountPaise * rateBps) / 10_000)`
 */
export function computeBasisPointsPaise(
  amountPaise: bigint,
  rateBps: bigint
): bigint {
  assertNonNegativePaise(amountPaise, "amountPaise");
  assertNonNegativePaise(rateBps, "rateBps");
  return divideRoundHalfUp(amountPaise * rateBps, BPS_SCALE);
}

// ============================================================================
// COMMISSION, GST & ESCROW TRANCHE CALCULATOR
// ============================================================================

/**
 * Calculates the 5% platform commission in integer paise for a given gross amount.
 */
export function calculatePlatformFeePaise(grossAmountPaise: bigint): bigint {
  assertNonNegativePaise(grossAmountPaise, "grossAmountPaise");
  return computeBasisPointsPaise(grossAmountPaise, PLATFORM_COMMISSION_BPS);
}

/**
 * Calculates the 18% GST on the 5% platform commission in integer paise.
 */
export function calculateGstOnFeePaise(platformFeePaise: bigint): bigint {
  assertNonNegativePaise(platformFeePaise, "platformFeePaise");
  return computeBasisPointsPaise(platformFeePaise, GST_ON_COMMISSION_BPS);
}

/**
 * Splits a campaign's gross pledged funds into the 3 milestone-gated escrow tranches
 * (`TRANCHE_1_30_PCT`, `TRANCHE_2_40_PCT`, `TRANCHE_3_30_PCT`) with:
 * - 5% Platform Fee
 * - 18% GST on the 5% Platform Fee
 * - Optional statutory TDS/TCS deduction
 *
 * Guarantees ZERO rounding drift:
 * - Every tranche satisfies `netPayoutPaise = grossAmountPaise - platformFeePaise - gstOnFeePaise - tdsTcsDeductedPaise`
 * - The sum of all 3 tranches equals `totalGrossAmountPaise`, `totalPlatformFeePaise`,
 *   `totalGstOnFeePaise`, `totalTdsTcsDeductedPaise`, and `totalNetPayoutPaise` to the exact paisa.
 */
export function calculateEscrowTrancheSchedule(
  totalGrossAmountPaise: bigint,
  options: TaxDeductionOptions = {}
): CampaignEscrowSchedule {
  assertPositivePaise(totalGrossAmountPaise, "totalGrossAmountPaise");

  const tdsTcsRateBps = options.tdsTcsRateBps ?? 0n;
  assertNonNegativePaise(tdsTcsRateBps, "tdsTcsRateBps");
  if (tdsTcsRateBps > 2_000n) {
    throw new RangeError(
      "tdsTcsRateBps exceeds maximum statutory cap (2000 bps / 20%)."
    );
  }

  // 1. Compute campaign-level aggregate targets in integer paise
  const totalPlatformFeePaise = calculatePlatformFeePaise(totalGrossAmountPaise);
  const totalGstOnFeePaise = calculateGstOnFeePaise(totalPlatformFeePaise);
  const totalTdsTcsDeductedPaise = computeBasisPointsPaise(
    totalGrossAmountPaise,
    tdsTcsRateBps
  );
  const totalNetPayoutPaise =
    totalGrossAmountPaise -
    totalPlatformFeePaise -
    totalGstOnFeePaise -
    totalTdsTcsDeductedPaise;

  // 2. Allocate Gross Amount across Tranche 1 (30%), Tranche 2 (40%), and Tranche 3 (30% residual)
  const t1Gross = computeBasisPointsPaise(
    totalGrossAmountPaise,
    TRANCHE_1_WEIGHT_BPS
  );
  const t2Gross = computeBasisPointsPaise(
    totalGrossAmountPaise,
    TRANCHE_2_WEIGHT_BPS
  );
  const t3Gross = totalGrossAmountPaise - t1Gross - t2Gross;

  // 3. Allocate Platform Fee (5%) across T1, T2, and T3 (residual absorbed in T3)
  const t1Fee = calculatePlatformFeePaise(t1Gross);
  const t2Fee = calculatePlatformFeePaise(t2Gross);
  const t3Fee = totalPlatformFeePaise - t1Fee - t2Fee;

  // 4. Allocate GST on Platform Fee (18% of fee) across T1, T2, and T3 (residual absorbed in T3)
  const t1Gst = calculateGstOnFeePaise(t1Fee);
  const t2Gst = calculateGstOnFeePaise(t2Fee);
  const t3Gst = totalGstOnFeePaise - t1Gst - t2Gst;

  // 5. Allocate statutory TDS/TCS across T1, T2, and T3 (residual absorbed in T3)
  const t1Tds = computeBasisPointsPaise(t1Gross, tdsTcsRateBps);
  const t2Tds = computeBasisPointsPaise(t2Gross, tdsTcsRateBps);
  const t3Tds = totalTdsTcsDeductedPaise - t1Tds - t2Tds;

  // 6. Compute exact Net Payout per tranche
  const t1Net = t1Gross - t1Fee - t1Gst - t1Tds;
  const t2Net = t2Gross - t2Fee - t2Gst - t2Tds;
  const t3Net = t3Gross - t3Fee - t3Gst - t3Tds;

  const tranche1: TrancheBreakdown = {
    trancheNumber: "TRANCHE_1_30_PCT",
    allocationBasisPoints: TRANCHE_1_WEIGHT_BPS,
    grossAmountPaise: t1Gross,
    platformFeePaise: t1Fee,
    gstOnFeePaise: t1Gst,
    tdsTcsDeductedPaise: t1Tds,
    netPayoutPaise: t1Net,
  };

  const tranche2: TrancheBreakdown = {
    trancheNumber: "TRANCHE_2_40_PCT",
    allocationBasisPoints: TRANCHE_2_WEIGHT_BPS,
    grossAmountPaise: t2Gross,
    platformFeePaise: t2Fee,
    gstOnFeePaise: t2Gst,
    tdsTcsDeductedPaise: t2Tds,
    netPayoutPaise: t2Net,
  };

  const tranche3: TrancheBreakdown = {
    trancheNumber: "TRANCHE_3_30_PCT",
    allocationBasisPoints: TRANCHE_3_WEIGHT_BPS,
    grossAmountPaise: t3Gross,
    platformFeePaise: t3Fee,
    gstOnFeePaise: t3Gst,
    tdsTcsDeductedPaise: t3Tds,
    netPayoutPaise: t3Net,
  };

  // Runtime invariant verification (Defense-in-depth for financial integrity)
  if (t1Gross + t2Gross + t3Gross !== totalGrossAmountPaise) {
    throw new Error("INVARIANT_VIOLATION: Tranche gross sum mismatch.");
  }
  if (t1Fee + t2Fee + t3Fee !== totalPlatformFeePaise) {
    throw new Error("INVARIANT_VIOLATION: Tranche platform fee sum mismatch.");
  }
  if (t1Gst + t2Gst + t3Gst !== totalGstOnFeePaise) {
    throw new Error("INVARIANT_VIOLATION: Tranche GST sum mismatch.");
  }
  if (t1Tds + t2Tds + t3Tds !== totalTdsTcsDeductedPaise) {
    throw new Error("INVARIANT_VIOLATION: Tranche TDS/TCS sum mismatch.");
  }
  if (t1Net + t2Net + t3Net !== totalNetPayoutPaise) {
    throw new Error("INVARIANT_VIOLATION: Tranche net payout sum mismatch.");
  }

  return {
    totalGrossAmountPaise,
    totalPlatformFeePaise,
    totalGstOnFeePaise,
    totalTdsTcsDeductedPaise,
    totalNetPayoutPaise,
    tranches: [tranche1, tranche2, tranche3],
  };
}

// ============================================================================
// PLEDGE CHECKOUT & EMBEDDED GST EXTRACTION
// ============================================================================

/**
 * Computes the pledge checkout total and extracts embedded GST from the GST-inclusive
 * reward tier price using integer basis points.
 *
 * @param baseAmountPaise - Reward tier price in paise (GST-inclusive)
 * @param addonsAmountPaise - Sum of selected add-ons in paise
 * @param shippingAmountPaise - Shipping charge in paise
 * @param rewardGstPercentage - e.g. 18.00 for 18% GST slab
 */
export function calculatePledgeCheckout(
  baseAmountPaise: bigint,
  addonsAmountPaise: bigint,
  shippingAmountPaise: bigint,
  rewardGstPercentage: number = 18
): PledgeCheckoutBreakdown {
  assertPositivePaise(baseAmountPaise, "baseAmountPaise");
  assertNonNegativePaise(addonsAmountPaise, "addonsAmountPaise");
  assertNonNegativePaise(shippingAmountPaise, "shippingAmountPaise");

  if (rewardGstPercentage < 0 || rewardGstPercentage > 28) {
    throw new RangeError("rewardGstPercentage must be between 0 and 28.");
  }

  const gstBps = BigInt(Math.round(rewardGstPercentage * 100));
  const taxableGoodsPaise = baseAmountPaise + addonsAmountPaise;

  // Embedded GST from GST-inclusive price: Tax = Price * gstBps / (10000 + gstBps)
  const embeddedRewardGstPaise = divideRoundHalfUp(
    taxableGoodsPaise * gstBps,
    BPS_SCALE + gstBps
  );
  const netPreTaxRewardPaise = taxableGoodsPaise - embeddedRewardGstPaise;
  const totalPaidPaise =
    baseAmountPaise + addonsAmountPaise + shippingAmountPaise;

  return {
    baseAmountPaise,
    addonsAmountPaise,
    shippingAmountPaise,
    totalPaidPaise,
    embeddedRewardGstPaise,
    netPreTaxRewardPaise,
  };
}

// ============================================================================
// DOUBLE-ENTRY LEDGER JOURNAL GENERATORS
// ============================================================================

/**
 * Generates balanced double-entry ledger lines when a backer's pledge is captured into escrow.
 * Debits `GATEWAY_ESCROW_RECEIVABLE` and credits `CAMPAIGN_ESCROW_LIABILITY`.
 */
export function buildPledgeCaptureLedgerEntries(params: {
  pledgeId: string;
  campaignId: string;
  totalPaidPaise: bigint;
  razorpayOrderId: string;
  razorpayPaymentId: string;
}): DoubleEntryLedgerLine[] {
  assertPositivePaise(params.totalPaidPaise, "totalPaidPaise");

  return [
    {
      referenceType: "PLEDGE_CAPTURE",
      referenceId: params.pledgeId,
      debitAccount: LEDGER_ACCOUNTS.GATEWAY_ESCROW_RECEIVABLE,
      creditAccount: LEDGER_ACCOUNTS.CAMPAIGN_ESCROW_LIABILITY,
      amountPaise: params.totalPaidPaise,
      metadataJson: {
        campaignId: params.campaignId,
        pledgeId: params.pledgeId,
        razorpayOrderId: params.razorpayOrderId,
        razorpayPaymentId: params.razorpayPaymentId,
        narration:
          "Backer pledge captured via Razorpay and locked in All-or-Nothing Campaign Escrow Liability",
      },
    },
  ];
}

/**
 * Generates balanced double-entry reversal ledger lines when an All-or-Nothing
 * campaign misses its goal and refunds a captured backer pledge.
 * Debits `CAMPAIGN_ESCROW_LIABILITY` and credits `GATEWAY_ESCROW_RECEIVABLE`.
 */
export function buildPledgeRefundLedgerEntries(params: {
  pledgeId: string;
  campaignId: string;
  totalPaidPaise: bigint;
  razorpayPaymentId: string;
  razorpayRefundId: string;
}): DoubleEntryLedgerLine[] {
  assertPositivePaise(params.totalPaidPaise, "totalPaidPaise");

  return [
    {
      referenceType: "PLEDGE_REFUND",
      referenceId: params.pledgeId,
      debitAccount: LEDGER_ACCOUNTS.CAMPAIGN_ESCROW_LIABILITY,
      creditAccount: LEDGER_ACCOUNTS.GATEWAY_ESCROW_RECEIVABLE,
      amountPaise: params.totalPaidPaise,
      metadataJson: {
        campaignId: params.campaignId,
        pledgeId: params.pledgeId,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpayRefundId: params.razorpayRefundId,
        narration:
          "All-or-Nothing campaign expiry refund disbursed to backer via Razorpay Refunds API",
      },
    },
  ];
}

/**
 * Generates balanced double-entry ledger lines when an escrow tranche is approved and disbursed.
 * Every paisa of `grossAmountPaise` is accounted for across:
 * 1. Platform Commission (5%)
 * 2. GST Output Liability (18% on 5% commission)
 * 3. Statutory TDS/TCS Withholding (if > 0)
 * 4. Net Creator Bank Settlement (disbursed via Razorpay Route)
 */
export function buildTrancheReleaseLedgerEntries(params: {
  trancheId: string;
  campaignId: string;
  tranche: TrancheBreakdown;
  razorpayTransferId: string;
}): DoubleEntryLedgerLine[] {
  const { trancheId, campaignId, tranche, razorpayTransferId } = params;
  const entries: DoubleEntryLedgerLine[] = [];

  // 1. Reclassify Tranche Gross from Backer Escrow Liability to Creator Settlement Payable
  entries.push({
    referenceType: "ESCROW_ADJUSTMENT",
    referenceId: trancheId,
    debitAccount: LEDGER_ACCOUNTS.BACKER_ESCROW_LIABILITY,
    creditAccount: LEDGER_ACCOUNTS.CREATOR_PAYABLE,
    amountPaise: tranche.grossAmountPaise,
    metadataJson: {
      campaignId,
      trancheId,
      trancheNumber: tranche.trancheNumber,
      narration: `Milestone ${tranche.trancheNumber} unlocked from Backer Escrow Liability`,
    },
  });

  // 2. Deduct 5% Platform Commission
  if (tranche.platformFeePaise > 0n) {
    entries.push({
      referenceType: "PLATFORM_COMMISSION_RECOGNITION",
      referenceId: trancheId,
      debitAccount: LEDGER_ACCOUNTS.CREATOR_PAYABLE,
      creditAccount: LEDGER_ACCOUNTS.PLATFORM_COMMISSION_REVENUE,
      amountPaise: tranche.platformFeePaise,
      metadataJson: {
        campaignId,
        trancheId,
        trancheNumber: tranche.trancheNumber,
        narration: `5% Platform Commission recognized on ${tranche.trancheNumber}`,
      },
    });
  }

  // 3. Deduct 18% GST on Platform Commission
  if (tranche.gstOnFeePaise > 0n) {
    entries.push({
      referenceType: "GST_LIABILITY_RECOGNITION",
      referenceId: trancheId,
      debitAccount: LEDGER_ACCOUNTS.CREATOR_PAYABLE,
      creditAccount: LEDGER_ACCOUNTS.GST_OUTPUT_PAYABLE,
      amountPaise: tranche.gstOnFeePaise,
      metadataJson: {
        campaignId,
        trancheId,
        trancheNumber: tranche.trancheNumber,
        narration: `18% GST on 5% Platform Commission recognized on ${tranche.trancheNumber}`,
      },
    });
  }

  // 4. Deduct Statutory TDS/TCS (if applicable)
  if (tranche.tdsTcsDeductedPaise > 0n) {
    entries.push({
      referenceType: "TDS_TCS_WITHHOLDING",
      referenceId: trancheId,
      debitAccount: LEDGER_ACCOUNTS.CREATOR_PAYABLE,
      creditAccount: LEDGER_ACCOUNTS.TDS_TCS_STATUTORY_PAYABLE,
      amountPaise: tranche.tdsTcsDeductedPaise,
      metadataJson: {
        campaignId,
        trancheId,
        trancheNumber: tranche.trancheNumber,
        narration: `Statutory TDS/TCS withheld on ${tranche.trancheNumber}`,
      },
    });
  }

  // 5. Disburse Net Payout from Escrow Trust Bank to Creator Linked Account
  if (tranche.netPayoutPaise > 0n) {
    entries.push({
      referenceType: "TRANCHE_DISBURSEMENT",
      referenceId: trancheId,
      debitAccount: LEDGER_ACCOUNTS.CREATOR_PAYABLE,
      creditAccount: LEDGER_ACCOUNTS.ESCROW_TRUST_BANK,
      amountPaise: tranche.netPayoutPaise,
      metadataJson: {
        campaignId,
        trancheId,
        trancheNumber: tranche.trancheNumber,
        razorpayTransferId,
        narration: `Net payout disbursed to Creator via Razorpay Route (${tranche.trancheNumber})`,
      },
    });
  }

  return entries;
}

// ============================================================================
// INR / PAISE FORMATTING UTILITIES (INDIAN NUMBERING SYSTEM: LAKHS / CRORES)
// ============================================================================

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inrWholeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats integer paise (`bigint`) into a standard Indian Rupee string (`₹1,25,000.00`)
 * without precision loss.
 */
export function formatPaiseToINR(
  paise: bigint,
  options: { includePaiseDecimals?: boolean } = { includePaiseDecimals: true }
): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = absPaise / 100n;
  const remainderPaise = absPaise % 100n;

  if (options.includePaiseDecimals === false && remainderPaise === 0n) {
    const formatted = inrWholeFormatter.format(rupees);
    return isNegative ? `-${formatted}` : formatted;
  }

  // Format whole rupees with en-IN grouping, then append exact 2-digit paise
  const formattedRupees = inrWholeFormatter.format(rupees);
  const paddedPaise = remainderPaise.toString().padStart(2, "0");
  const result = `${formattedRupees}.${paddedPaise}`;
  return isNegative ? `-${result}` : result;
}
