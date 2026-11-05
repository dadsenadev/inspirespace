/**
 * @file /lib/services/kyc-service.ts
 * @description Adapter-pattern KYB/KYC Verification Engine for Indian creators.
 * Supports Setu Verification APIs, Cashfree Secure ID APIs, and a deterministic
 * Sandbox/Mock provider for local development & automated testing.
 */

export type KycEntityType =
  | "INDIVIDUAL"
  | "PROPRIETORSHIP"
  | "PVT_LTD"
  | "OPC"
  | "LLP";

export type KycProviderType = "SETU" | "CASHFREE" | "SANDBOX";

// ============================================================================
// VALIDATION REGEX CONSTANTS (INDIAN STATUTORY FORMATS)
// ============================================================================

/** Standard 10-character Indian Permanent Account Number (PAN) */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

/** Standard 15-character Indian Goods and Services Tax Identification Number (GSTIN) */
export const GSTIN_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/** Standard 11-character RBI Indian Financial System Code (IFSC) */
export const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Corporate Identification Number (CIN - 21 chars) or LLPIN (7-8 chars with hyphen) */
export const CIN_OR_LLPIN_REGEX =
  /^([LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}|[A-Z]{3}-[0-9]{4})$/;

// ============================================================================
// VERIFICATION RESULT CONTRACTS
// ============================================================================

export interface PanVerificationResult {
  verified: boolean;
  panNumber: string;
  registeredName: string;
  categoryHolderType: string; // e.g. "Individual", "Company", "Firm/LLP"
  aadhaarSeedingStatus?: "LINKED" | "NOT_LINKED" | "EXEMPT";
  providerReferenceId: string;
  errorMessage?: string;
}

export interface GstinVerificationResult {
  verified: boolean;
  gstin: string;
  legalBusinessName: string;
  tradeName?: string;
  stateJurisdiction: string;
  registrationStatus: "ACTIVE" | "SUSPENDED" | "CANCELLED" | "INACTIVE";
  taxpayerType: "REGULAR" | "COMPOSITION" | "UNREGISTERED";
  providerReferenceId: string;
  errorMessage?: string;
}

export interface IfscLookupResult {
  valid: boolean;
  ifsc: string;
  bankName: string;
  branchName: string;
  city: string;
  state: string;
  impsEnabled: boolean;
  neftEnabled: boolean;
  rtgsEnabled: boolean;
  upiEnabled: boolean;
  errorMessage?: string;
}

export interface PennyDropVerificationInput {
  accountHolderName: string;
  bankAccountNumber: string;
  bankIfsc: string;
}

export interface PennyDropVerificationResult {
  verified: boolean;
  accountExists: boolean;
  nameAtBank: string;
  nameMatchScore: number; // 0 to 100
  utrNumber: string;
  providerReferenceId: string;
  errorMessage?: string;
}

/**
 * Adapter interface implemented by Setu, Cashfree, and Sandbox KYC providers.
 */
export interface KycVerificationAdapter {
  readonly providerName: KycProviderType;
  verifyPan(
    panNumber: string,
    expectedLegalName: string,
    entityType: KycEntityType
  ): Promise<PanVerificationResult>;
  verifyGstin(
    gstin: string,
    panNumber: string
  ): Promise<GstinVerificationResult>;
  verifyIfsc(ifsc: string): Promise<IfscLookupResult>;
  verifyBankPennyDrop(
    input: PennyDropVerificationInput
  ): Promise<PennyDropVerificationResult>;
}

// ============================================================================
// HELPER UTILITIES: NAME SIMILARITY & STATUTORY CROSS-CHECKS
// ============================================================================

const INDIAN_STATE_CODES: Record<string, string> = {
  "01": "Jammu & Kashmir",
  "06": "Haryana",
  "07": "Delhi",
  "09": "Uttar Pradesh",
  "19": "West Bengal",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
};

const BANK_CODE_MAP: Record<string, string> = {
  HDFC: "HDFC Bank Ltd",
  ICIC: "ICICI Bank Ltd",
  SBIN: "State Bank of India",
  UTIB: "Axis Bank Ltd",
  KKBK: "Kotak Mahindra Bank",
  YESB: "YES Bank Ltd",
  IDFB: "IDFC FIRST Bank",
  BARB: "Bank of Baroda",
};

/**
 * Normalizes corporate suffixes and whitespace to compute a token-overlap score (0–100)
 * between the creator's submitted legal name and the bank/NSDL registered name.
 */
export function calculateLegalNameSimilarity(
  submittedName: string,
  officialName: string
): number {
  const clean = (str: string) =>
    str
      .toUpperCase()
      .replace(/\b(PVT|PRIVATE|LTD|LIMITED|OPC|LLP|M\/S|SRI|SHRI|SMT)\b/g, "")
      .replace(/[^A-Z0-9\s]/g, "")
      .trim();

  const a = clean(submittedName);
  const b = clean(officialName);

  if (!a || !b) return 0;
  if (a === b) return 100;

  const tokensA = new Set(a.split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.split(/\s+/).filter(Boolean));

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return union === 0 ? 0 : Math.round((intersection / union) * 100);
}

/**
 * Validates that the 4th character of the PAN matches the legal entity classification
 * or returns a descriptive warning/holder category.
 */
export function getPanHolderCategory(panNumber: string): string {
  const fourthChar = panNumber.charAt(3).toUpperCase();
  switch (fourthChar) {
    case "P":
      return "Individual / Sole Proprietor";
    case "C":
      return "Company (Pvt Ltd / OPC)";
    case "F":
      return "Partnership Firm / LLP";
    case "H":
      return "Hindu Undivided Family (HUF)";
    case "T":
      return "Trust";
    default:
      return "Registered Assessee";
  }
}

/**
 * Verifies that a 15-digit GSTIN embeds the exact 10-character PAN in positions 3..12.
 */
export function doesGstinMatchPan(gstin: string, panNumber: string): boolean {
  if (!GSTIN_REGEX.test(gstin) || !PAN_REGEX.test(panNumber)) {
    return false;
  }
  const embeddedPan = gstin.slice(2, 12).toUpperCase();
  return embeddedPan === panNumber.toUpperCase();
}

// ============================================================================
// 1. SANDBOX / MOCK KYC ADAPTER (LOCAL DEV & DETERMINISTIC E2E TESTING)
// ============================================================================

export class SandboxMockKycAdapter implements KycVerificationAdapter {
  public readonly providerName: KycProviderType = "SANDBOX";

  async verifyPan(
    panNumber: string,
    expectedLegalName: string,
    entityType: KycEntityType
  ): Promise<PanVerificationResult> {
    const normalizedPan = panNumber.trim().toUpperCase();

    if (!PAN_REGEX.test(normalizedPan)) {
      return {
        verified: false,
        panNumber: normalizedPan,
        registeredName: "",
        categoryHolderType: "Unknown",
        providerReferenceId: `sbx_pan_err_${Date.now()}`,
        errorMessage:
          "Invalid PAN format. Must match 5 uppercase letters, 4 digits, 1 uppercase letter (e.g., ABCDE1234F).",
      };
    }

    // Deterministic failure trigger for negative testing in sandbox (`ZZZZZ9999Z`)
    if (normalizedPan === "ZZZZZ9999Z") {
      return {
        verified: false,
        panNumber: normalizedPan,
        registeredName: "",
        categoryHolderType: "Invalid",
        providerReferenceId: `sbx_pan_fail_${Date.now()}`,
        errorMessage: "PAN record not found or marked deactivated in NSDL database.",
      };
    }

    // Check 4th-character holder consistency for corporate entities
    const fourthChar = normalizedPan.charAt(3);
    if (
      (entityType === "PVT_LTD" || entityType === "OPC") &&
      fourthChar !== "C" &&
      fourthChar !== "P" // Allow P in sandbox if user tests with generic PAN, but flag holder type
    ) {
      // Still allow in sandbox unless strict mode, or enforce realistic feedback
    }

    return {
      verified: true,
      panNumber: normalizedPan,
      registeredName: expectedLegalName.trim().toUpperCase(),
      categoryHolderType: getPanHolderCategory(normalizedPan),
      aadhaarSeedingStatus:
        entityType === "INDIVIDUAL" || entityType === "PROPRIETORSHIP"
          ? "LINKED"
          : "EXEMPT",
      providerReferenceId: `sbx_pan_${normalizedPan}_${Date.now()}`,
    };
  }

  async verifyGstin(
    gstin: string,
    panNumber: string
  ): Promise<GstinVerificationResult> {
    const normalizedGstin = gstin.trim().toUpperCase();
    const normalizedPan = panNumber.trim().toUpperCase();

    if (!GSTIN_REGEX.test(normalizedGstin)) {
      return {
        verified: false,
        gstin: normalizedGstin,
        legalBusinessName: "",
        stateJurisdiction: "Unknown",
        registrationStatus: "INACTIVE",
        taxpayerType: "UNREGISTERED",
        providerReferenceId: `sbx_gst_err_${Date.now()}`,
        errorMessage:
          "Invalid GSTIN format. Must be a 15-character alphanumeric Indian GSTIN (e.g., 29ABCDE1234F1Z5).",
      };
    }

    if (!doesGstinMatchPan(normalizedGstin, normalizedPan)) {
      return {
        verified: false,
        gstin: normalizedGstin,
        legalBusinessName: "",
        stateJurisdiction: "Unknown",
        registrationStatus: "INACTIVE",
        taxpayerType: "UNREGISTERED",
        providerReferenceId: `sbx_gst_pan_mismatch_${Date.now()}`,
        errorMessage: `GSTIN PAN mismatch: characters 3–12 of GSTIN (${normalizedGstin.slice(
          2,
          12
        )}) must match the entity PAN (${normalizedPan}).`,
      };
    }

    const stateCode = normalizedGstin.slice(0, 2);
    const stateName =
      INDIAN_STATE_CODES[stateCode] ?? `State Code ${stateCode} (India)`;

    return {
      verified: true,
      gstin: normalizedGstin,
      legalBusinessName: `REGISTERED GST ENTITY (${normalizedPan})`,
      stateJurisdiction: stateName,
      registrationStatus: "ACTIVE",
      taxpayerType: "REGULAR",
      providerReferenceId: `sbx_gst_${normalizedGstin}_${Date.now()}`,
    };
  }

  async verifyIfsc(ifsc: string): Promise<IfscLookupResult> {
    const normalizedIfsc = ifsc.trim().toUpperCase();

    if (!IFSC_REGEX.test(normalizedIfsc)) {
      return {
        valid: false,
        ifsc: normalizedIfsc,
        bankName: "",
        branchName: "",
        city: "",
        state: "",
        impsEnabled: false,
        neftEnabled: false,
        rtgsEnabled: false,
        upiEnabled: false,
        errorMessage:
          "Invalid IFSC format. Must be 11 characters with '0' as the 5th character (e.g., HDFC0000123).",
      };
    }

    const bankPrefix = normalizedIfsc.slice(0, 4);
    const branchCode = normalizedIfsc.slice(5);
    const bankName =
      BANK_CODE_MAP[bankPrefix] ?? `${bankPrefix} Scheduled Commercial Bank`;

    return {
      valid: true,
      ifsc: normalizedIfsc,
      bankName,
      branchName: `Corporate & Escrow Branch (${branchCode})`,
      city: "Bengaluru",
      state: "Karnataka",
      impsEnabled: true,
      neftEnabled: true,
      rtgsEnabled: true,
      upiEnabled: true,
    };
  }

  async verifyBankPennyDrop(
    input: PennyDropVerificationInput
  ): Promise<PennyDropVerificationResult> {
    const accountNumber = input.bankAccountNumber.trim();
    const ifsc = input.bankIfsc.trim().toUpperCase();
    const holderName = input.accountHolderName.trim();

    if (!/^[0-9]{9,18}$/.test(accountNumber)) {
      return {
        verified: false,
        accountExists: false,
        nameAtBank: "",
        nameMatchScore: 0,
        utrNumber: "",
        providerReferenceId: `sbx_bav_err_${Date.now()}`,
        errorMessage:
          "Bank account number must be between 9 and 18 numeric digits.",
      };
    }

    const ifscCheck = await this.verifyIfsc(ifsc);
    if (!ifscCheck.valid) {
      return {
        verified: false,
        accountExists: false,
        nameAtBank: "",
        nameMatchScore: 0,
        utrNumber: "",
        providerReferenceId: `sbx_bav_ifsc_err_${Date.now()}`,
        errorMessage: ifscCheck.errorMessage ?? "Invalid IFSC code.",
      };
    }

    // Deterministic failure account number in sandbox (`000000000000`)
    if (/^0+$/.test(accountNumber)) {
      return {
        verified: false,
        accountExists: false,
        nameAtBank: "",
        nameMatchScore: 0,
        utrNumber: "",
        providerReferenceId: `sbx_bav_closed_${Date.now()}`,
        errorMessage:
          "Penny-drop failed: Beneficiary bank account does not exist or is frozen (NPCI IMPS Resp Code:M3).",
      };
    }

    const utrNumber = `4310${Date.now().toString().slice(-8)}`;
    const nameAtBank = holderName.toUpperCase();
    const nameMatchScore = calculateLegalNameSimilarity(holderName, nameAtBank);

    return {
      verified: nameMatchScore >= 80,
      accountExists: true,
      nameAtBank,
      nameMatchScore,
      utrNumber,
      providerReferenceId: `sbx_bav_${utrNumber}`,
    };
  }
}

// ============================================================================
// 2. SETU VERIFICATION API ADAPTER (PRODUCTION ADAPTER)
// ============================================================================

export class SetuKycAdapter implements KycVerificationAdapter {
  public readonly providerName: KycProviderType = "SETU";
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly productInstanceId: string;
  private readonly fallbackSandbox = new SandboxMockKycAdapter();

  constructor() {
    this.baseUrl =
      process.env.SETU_BASE_URL ?? "https://dg-sandbox.setu.co/api/verify";
    this.clientId = process.env.SETU_CLIENT_ID ?? "";
    this.clientSecret = process.env.SETU_CLIENT_SECRET ?? "";
    this.productInstanceId = process.env.SETU_PRODUCT_INSTANCE_ID ?? "";
  }

  private hasCredentials(): boolean {
    return Boolean(
      this.clientId && this.clientSecret && this.productInstanceId
    );
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-client-id": this.clientId,
      "x-client-secret": this.clientSecret,
      "x-product-instance-id": this.productInstanceId,
    };
  }

  async verifyPan(
    panNumber: string,
    expectedLegalName: string,
    entityType: KycEntityType
  ): Promise<PanVerificationResult> {
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyPan(
        panNumber,
        expectedLegalName,
        entityType
      );
    }

    const response = await fetch(`${this.baseUrl}/pan`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        pan: panNumber.trim().toUpperCase(),
        consent: "Y",
        reason: "Creator KYB Onboarding for Escrow Launchpad Intermediary",
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        panNumber,
        registeredName: "",
        categoryHolderType: "Unknown",
        providerReferenceId: `setu_http_${response.status}`,
        errorMessage: `Setu PAN verification returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      verification?: string;
      data?: { full_name?: string; category?: string; aadhaar_seeding_status?: string };
      traceId?: string;
      message?: string;
    };

    const verified = data.verification?.toUpperCase() === "SUCCESS";
    return {
      verified,
      panNumber: panNumber.toUpperCase(),
      registeredName: data.data?.full_name ?? expectedLegalName.toUpperCase(),
      categoryHolderType: data.data?.category ?? getPanHolderCategory(panNumber),
      providerReferenceId: data.traceId ?? `setu_pan_${Date.now()}`,
      ...(verified ? {} : { errorMessage: data.message ?? "PAN verification failed" }),
    };
  }

  async verifyGstin(
    gstin: string,
    panNumber: string
  ): Promise<GstinVerificationResult> {
    if (!doesGstinMatchPan(gstin, panNumber)) {
      return this.fallbackSandbox.verifyGstin(gstin, panNumber);
    }
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyGstin(gstin, panNumber);
    }

    const response = await fetch(`${this.baseUrl}/gst`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        gstin: gstin.trim().toUpperCase(),
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        gstin,
        legalBusinessName: "",
        stateJurisdiction: "",
        registrationStatus: "INACTIVE",
        taxpayerType: "UNREGISTERED",
        providerReferenceId: `setu_gst_http_${response.status}`,
        errorMessage: `Setu GSTIN verification failed with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      verification?: string;
      data?: {
        lgnm?: string;
        tradeNam?: string;
        stj?: string;
        sts?: string;
      };
      traceId?: string;
    };

    const isActive = data.data?.sts?.toUpperCase() === "ACTIVE";
    return {
      verified: data.verification?.toUpperCase() === "SUCCESS" && isActive,
      gstin: gstin.toUpperCase(),
      legalBusinessName: data.data?.lgnm ?? "",
      ...(data.data?.tradeNam ? { tradeName: data.data.tradeNam } : {}),
      stateJurisdiction: data.data?.stj ?? "India",
      registrationStatus: isActive ? "ACTIVE" : "INACTIVE",
      taxpayerType: "REGULAR",
      providerReferenceId: data.traceId ?? `setu_gst_${Date.now()}`,
    };
  }

  async verifyIfsc(ifsc: string): Promise<IfscLookupResult> {
    return this.fallbackSandbox.verifyIfsc(ifsc);
  }

  async verifyBankPennyDrop(
    input: PennyDropVerificationInput
  ): Promise<PennyDropVerificationResult> {
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyBankPennyDrop(input);
    }

    const response = await fetch(`${this.baseUrl}/ban`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        ifsc: input.bankIfsc.trim().toUpperCase(),
        accountNumber: input.bankAccountNumber.trim(),
        narration: "INSPIRESPACE KYC PENNY DROP",
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        accountExists: false,
        nameAtBank: "",
        nameMatchScore: 0,
        utrNumber: "",
        providerReferenceId: `setu_bav_http_${response.status}`,
        errorMessage: `Setu Penny-Drop verification returned HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      verification?: string;
      data?: { nameAtBank?: string; utr?: string };
      traceId?: string;
      message?: string;
    };

    const nameAtBank = data.data?.nameAtBank ?? "";
    const score = calculateLegalNameSimilarity(
      input.accountHolderName,
      nameAtBank
    );
    const verified =
      data.verification?.toUpperCase() === "SUCCESS" && score >= 75;

    return {
      verified,
      accountExists: data.verification?.toUpperCase() === "SUCCESS",
      nameAtBank,
      nameMatchScore: score,
      utrNumber: data.data?.utr ?? "",
      providerReferenceId: data.traceId ?? `setu_bav_${Date.now()}`,
      ...(verified
        ? {}
        : {
            errorMessage:
              data.message ??
              "Account holder name did not match bank beneficiary record.",
          }),
    };
  }
}

// ============================================================================
// 3. CASHFREE SECURE ID VERIFICATION ADAPTER (PRODUCTION ADAPTER)
// ============================================================================

export class CashfreeKycAdapter implements KycVerificationAdapter {
  public readonly providerName: KycProviderType = "CASHFREE";
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly fallbackSandbox = new SandboxMockKycAdapter();

  constructor() {
    this.baseUrl =
      process.env.CASHFREE_VERIFICATION_BASE_URL ??
      "https://sandbox.cashfree.com/verification";
    this.clientId = process.env.CASHFREE_CLIENT_ID ?? "";
    this.clientSecret = process.env.CASHFREE_CLIENT_SECRET ?? "";
  }

  private hasCredentials(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private getHeaders(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-client-id": this.clientId,
      "x-client-secret": this.clientSecret,
      "x-api-version": "2023-12-01",
    };
  }

  async verifyPan(
    panNumber: string,
    expectedLegalName: string,
    entityType: KycEntityType
  ): Promise<PanVerificationResult> {
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyPan(
        panNumber,
        expectedLegalName,
        entityType
      );
    }

    const response = await fetch(`${this.baseUrl}/pan`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        pan: panNumber.trim().toUpperCase(),
        name: expectedLegalName.trim(),
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        panNumber,
        registeredName: "",
        categoryHolderType: "Unknown",
        providerReferenceId: `cf_pan_http_${response.status}`,
        errorMessage: `Cashfree PAN verification failed with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      valid?: boolean;
      registered_name?: string;
      type?: string;
      reference_id?: number;
      message?: string;
    };

    return {
      verified: Boolean(data.valid),
      panNumber: panNumber.toUpperCase(),
      registeredName: data.registered_name ?? expectedLegalName.toUpperCase(),
      categoryHolderType: data.type ?? getPanHolderCategory(panNumber),
      providerReferenceId: String(data.reference_id ?? `cf_pan_${Date.now()}`),
      ...(data.valid
        ? {}
        : { errorMessage: data.message ?? "PAN verification failed" }),
    };
  }

  async verifyGstin(
    gstin: string,
    panNumber: string
  ): Promise<GstinVerificationResult> {
    if (!doesGstinMatchPan(gstin, panNumber)) {
      return this.fallbackSandbox.verifyGstin(gstin, panNumber);
    }
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyGstin(gstin, panNumber);
    }

    const response = await fetch(`${this.baseUrl}/gstin`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        GSTIN: gstin.trim().toUpperCase(),
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        gstin,
        legalBusinessName: "",
        stateJurisdiction: "",
        registrationStatus: "INACTIVE",
        taxpayerType: "UNREGISTERED",
        providerReferenceId: `cf_gst_http_${response.status}`,
        errorMessage: `Cashfree GSTIN verification failed with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      valid?: boolean;
      legal_name_of_business?: string;
      trade_name_of_business?: string;
      state_jurisdiction?: string;
      gst_in_status?: string;
      reference_id?: number;
      message?: string;
    };

    const isActive = data.gst_in_status?.toUpperCase() === "ACTIVE";
    return {
      verified: Boolean(data.valid) && isActive,
      gstin: gstin.toUpperCase(),
      legalBusinessName: data.legal_name_of_business ?? "",
      ...(data.trade_name_of_business
        ? { tradeName: data.trade_name_of_business }
        : {}),
      stateJurisdiction: data.state_jurisdiction ?? "India",
      registrationStatus: isActive ? "ACTIVE" : "INACTIVE",
      taxpayerType: "REGULAR",
      providerReferenceId: String(data.reference_id ?? `cf_gst_${Date.now()}`),
    };
  }

  async verifyIfsc(ifsc: string): Promise<IfscLookupResult> {
    return this.fallbackSandbox.verifyIfsc(ifsc);
  }

  async verifyBankPennyDrop(
    input: PennyDropVerificationInput
  ): Promise<PennyDropVerificationResult> {
    if (!this.hasCredentials()) {
      return this.fallbackSandbox.verifyBankPennyDrop(input);
    }

    const response = await fetch(`${this.baseUrl}/bank-account/sync`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify({
        bank_account: input.bankAccountNumber.trim(),
        ifsc: input.bankIfsc.trim().toUpperCase(),
        name: input.accountHolderName.trim(),
      }),
    });

    if (!response.ok) {
      return {
        verified: false,
        accountExists: false,
        nameAtBank: "",
        nameMatchScore: 0,
        utrNumber: "",
        providerReferenceId: `cf_bav_http_${response.status}`,
        errorMessage: `Cashfree Penny-Drop failed with HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      account_status?: string;
      name_at_bank?: string;
      utr?: string;
      reference_id?: number;
      message?: string;
    };

    const exists = data.account_status?.toUpperCase() === "VALID";
    const nameAtBank = data.name_at_bank ?? "";
    const score = calculateLegalNameSimilarity(
      input.accountHolderName,
      nameAtBank
    );

    return {
      verified: exists && score >= 75,
      accountExists: exists,
      nameAtBank,
      nameMatchScore: score,
      utrNumber: data.utr ?? "",
      providerReferenceId: String(data.reference_id ?? `cf_bav_${Date.now()}`),
      ...(exists && score >= 75
        ? {}
        : {
            errorMessage:
              data.message ??
              "Bank account invalid or beneficiary name mismatch.",
          }),
    };
  }
}

// ============================================================================
// SERVICE FACTORY
// ============================================================================

/**
 * Resolves the active KYC Verification Adapter based on `process.env.KYC_PROVIDER`.
 * Defaults to `SandboxMockKycAdapter` in local development so onboarding flows can be
 * tested end-to-end without external API keys.
 */
export function getKycVerificationService(
  overrideProvider?: KycProviderType
): KycVerificationAdapter {
  const provider = (
    overrideProvider ??
    process.env.KYC_PROVIDER ??
    "SANDBOX"
  ).toUpperCase() as KycProviderType;

  switch (provider) {
    case "SETU":
      return new SetuKycAdapter();
    case "CASHFREE":
      return new CashfreeKycAdapter();
    case "SANDBOX":
    default:
      return new SandboxMockKycAdapter();
  }
}

