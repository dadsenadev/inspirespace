"use client";

import * as React from "react";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  KYC_STORAGE_KEY,
  VerificationStatusBanner,
  type KycVerificationStatus,
} from "@/components/creator/verification-status-banner";
import {
  verifyAndSaveStep1Action,
  verifyAndSaveStep2Action,
  lookupIfscBranchAction,
  verifyBankAndProvisionRouteAction,
} from "./actions";
import type {
  KycEntityType,
  PanVerificationResult,
  GstinVerificationResult,
  IfscLookupResult,
  PennyDropVerificationResult,
} from "@/lib/services/kyc-service";
import type { RazorpayLinkedAccountResponse } from "@/lib/services/razorpay-route";

const PAN_CLIENT_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const GSTIN_CLIENT_REGEX =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const IFSC_CLIENT_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;

interface WizardPersistedState {
  currentStep: 1 | 2 | 3;
  kycStatus: KycVerificationStatus;
  // Step 1
  legalName: string;
  entityType: KycEntityType;
  panNumber: string;
  cinNumber: string;
  identityDocumentName: string;
  identityDocumentSizeKb?: number;
  step1Verified: boolean;
  panVerification?: PanVerificationResult;
  // Step 2
  isGstRegistered: boolean;
  gstin: string;
  nonGstMicroCreatorDeclaration: boolean;
  acceptedIntermediaryAndEscrowTerms: boolean;
  step2Verified: boolean;
  gstinVerification?: GstinVerificationResult;
  // Step 3
  accountHolderName: string;
  bankAccountNumber: string;
  confirmBankAccountNumber: string;
  bankIfsc: string;
  ifscDetails?: IfscLookupResult;
  pennyDropResult?: PennyDropVerificationResult;
  razorpayRouteResult?: RazorpayLinkedAccountResponse;
  razorpayLinkedAccountId?: string;
  verifiedAtIso?: string;
}

const DEFAULT_WIZARD_STATE: WizardPersistedState = {
  currentStep: 1,
  kycStatus: "DRAFT",
  legalName: "",
  entityType: "PVT_LTD",
  panNumber: "",
  cinNumber: "",
  identityDocumentName: "",
  step1Verified: false,
  isGstRegistered: true,
  gstin: "",
  nonGstMicroCreatorDeclaration: false,
  acceptedIntermediaryAndEscrowTerms: false,
  step2Verified: false,
  accountHolderName: "",
  bankAccountNumber: "",
  confirmBankAccountNumber: "",
  bankIfsc: "",
};

const ENTITY_OPTIONS: Array<{
  value: KycEntityType;
  label: string;
  subtitle: string;
  mandatoryGst: boolean;
}> = [
  {
    value: "INDIVIDUAL",
    label: "Individual Creator",
    subtitle: "Independent maker, comic artist, or solo game designer",
    mandatoryGst: false,
  },
  {
    value: "PROPRIETORSHIP",
    label: "Sole Proprietorship",
    subtitle: "MSME / Udyam registered studio or artisanal workshop",
    mandatoryGst: false,
  },
  {
    value: "OPC",
    label: "One Person Company (OPC Pvt Ltd)",
    subtitle: "MCA incorporated single-founder corporate entity",
    mandatoryGst: true,
  },
  {
    value: "PVT_LTD",
    label: "Private Limited Company (Pvt Ltd)",
    subtitle: "Commercial D2C hardware or consumer product brand",
    mandatoryGst: true,
  },
  {
    value: "LLP",
    label: "Limited Liability Partnership (LLP)",
    subtitle: "Registered creative partnership or hardware collective",
    mandatoryGst: true,
  },
];

export function CreatorOnboardingWizard() {
  const [state, setState] =
    React.useState<WizardPersistedState>(DEFAULT_WIZARD_STATE);
  const [hydrated, setHydrated] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);

  // Hydrate persistent wizard state from localStorage on mount
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KYC_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<WizardPersistedState>;
        setState((prev) => ({
          ...prev,
          ...parsed,
        }));
      }
    } catch {
      // Ignore malformed storage
    } finally {
      setHydrated(true);
    }
  }, []);

  // Persist state changes and notify VerificationStatusBanner
  const updatePersistedState = React.useCallback(
    (updater: (prev: WizardPersistedState) => WizardPersistedState) => {
      setState((prev) => {
        const next = updater(prev);
        try {
          window.localStorage.setItem(KYC_STORAGE_KEY, JSON.stringify(next));
          window.dispatchEvent(new Event("inspirespace-kyc-updated"));
        } catch {
          // Ignore storage write errors
        }
        return next;
      });
    },
    []
  );

  const isCorporateEntity =
    state.entityType === "PVT_LTD" ||
    state.entityType === "OPC" ||
    state.entityType === "LLP";

  // Automatically enforce GST registration toggle when a corporate entity is selected
  React.useEffect(() => {
    if (isCorporateEntity && !state.isGstRegistered) {
      updatePersistedState((prev) => ({
        ...prev,
        isGstRegistered: true,
      }));
    }
  }, [isCorporateEntity, state.isGstRegistered, updatePersistedState]);

  // Live IFSC Lookup when 11-char valid IFSC is entered
  const handleIfscChange = (rawIfsc: string) => {
    const upper = rawIfsc.toUpperCase().slice(0, 11);
    updatePersistedState((prev) => ({
      ...prev,
      bankIfsc: upper,
    }));

    if (IFSC_CLIENT_REGEX.test(upper)) {
      startTransition(async () => {
        const lookup = await lookupIfscBranchAction(upper);
        updatePersistedState((prev) => ({
          ...prev,
          ifscDetails: lookup,
        }));
      });
    }
  };

  // Sample Demo Autofill for rapid reviewer testing
  const fillSampleCorporateKyc = () => {
    setErrorBanner(null);
    updatePersistedState((prev) => ({
      ...prev,
      legalName: "Vayu Precision Hardware Private Limited",
      entityType: "PVT_LTD",
      panNumber: "AAACV4821C",
      cinNumber: "U26100KA2024PTC182910",
      identityDocumentName: "MCA_COI_Vayu_Precision_Hardware_2024.pdf",
      identityDocumentSizeKb: 412,
      isGstRegistered: true,
      gstin: "29AAACV4821C1Z5",
      acceptedIntermediaryAndEscrowTerms: true,
      accountHolderName: "Vayu Precision Hardware Private Limited",
      bankAccountNumber: "50200084910234",
      confirmBankAccountNumber: "50200084910234",
      bankIfsc: "HDFC0000240",
    }));
  };

  const resetOnboardingState = () => {
    setErrorBanner(null);
    window.localStorage.removeItem(KYC_STORAGE_KEY);
    setState(DEFAULT_WIZARD_STATE);
    window.dispatchEvent(new Event("inspirespace-kyc-updated"));
  };

  // Step 1 Submit Handler
  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    startTransition(async () => {
      const res = await verifyAndSaveStep1Action({
        userId: "00000000-0000-4000-8000-000000000101",
        legalName: state.legalName,
        entityType: state.entityType,
        panNumber: state.panNumber,
        cinNumber: state.cinNumber,
        identityDocumentName: state.identityDocumentName,
        identityDocumentType: isCorporateEntity
          ? "INCORPORATION_CERTIFICATE"
          : "AADHAAR_MASKED_PDF",
      });

      if (!res.success) {
        setErrorBanner(res.error ?? "Step 1 verification failed.");
        return;
      }

      updatePersistedState((prev) => ({
        ...prev,
        step1Verified: true,
        ...(res.panVerification
          ? { panVerification: res.panVerification }
          : {}),
        accountHolderName: prev.accountHolderName || prev.legalName,
        currentStep: 2,
      }));
    });
  };

  // Step 2 Submit Handler
  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    startTransition(async () => {
      const res = await verifyAndSaveStep2Action({
        userId: "00000000-0000-4000-8000-000000000101",
        entityType: state.entityType,
        panNumber: state.panNumber,
        isGstRegistered: state.isGstRegistered,
        ...(state.isGstRegistered ? { gstin: state.gstin } : {}),
        nonGstMicroCreatorDeclaration: state.nonGstMicroCreatorDeclaration,
        acceptedIntermediaryAndEscrowTerms:
          state.acceptedIntermediaryAndEscrowTerms,
      });

      if (!res.success) {
        setErrorBanner(res.error ?? "Step 2 tax verification failed.");
        return;
      }

      updatePersistedState((prev) => ({
        ...prev,
        step2Verified: true,
        ...(res.gstinVerification
          ? { gstinVerification: res.gstinVerification }
          : {}),
        currentStep: 3,
      }));
    });
  };

  // Step 3 Submit Handler (Penny-Drop + Razorpay Route Provisioning)
  const handleStep3Submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    startTransition(async () => {
      const res = await verifyBankAndProvisionRouteAction({
        userId: "00000000-0000-4000-8000-000000000101",
        email: "founders@vayuhardware.in",
        phone: "9845012345",
        legalName: state.legalName,
        entityType: state.entityType,
        panNumber: state.panNumber,
        ...(isCorporateEntity ? { cinNumber: state.cinNumber } : {}),
        ...(state.isGstRegistered ? { gstin: state.gstin } : {}),
        accountHolderName: state.accountHolderName,
        bankAccountNumber: state.bankAccountNumber,
        confirmBankAccountNumber: state.confirmBankAccountNumber,
        bankIfsc: state.bankIfsc,
      });

      if (!res.success) {
        setErrorBanner(
          res.error ?? "Penny-drop or Razorpay Route provisioning failed."
        );
        updatePersistedState((prev) => ({
          ...prev,
          ...(res.ifscDetails ? { ifscDetails: res.ifscDetails } : {}),
          ...(res.pennyDropResult
            ? { pennyDropResult: res.pennyDropResult }
            : {}),
          ...(res.razorpayRouteResult
            ? { razorpayRouteResult: res.razorpayRouteResult }
            : {}),
          kycStatus: res.kycStatus ?? "REJECTED",
        }));
        return;
      }

      updatePersistedState((prev) => ({
        ...prev,
        ...(res.ifscDetails ? { ifscDetails: res.ifscDetails } : {}),
        ...(res.pennyDropResult
          ? { pennyDropResult: res.pennyDropResult }
          : {}),
        ...(res.razorpayRouteResult
          ? {
              razorpayRouteResult: res.razorpayRouteResult,
              razorpayLinkedAccountId:
                res.razorpayRouteResult.razorpayLinkedAccountId,
            }
          : {}),
        kycStatus: "APPROVED",
        ...(res.verifiedAtIso ? { verifiedAtIso: res.verifiedAtIso } : {}),
      }));
    });
  };

  if (!hydrated) {
    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-8 text-sm text-slate-500">
        Loading persistent KYB/KYC onboarding state...
      </div>
    );
  }

  const isPanValidFormat = PAN_CLIENT_REGEX.test(state.panNumber);
  const isGstinValidFormat = GSTIN_CLIENT_REGEX.test(state.gstin);
  const embeddedPanMatches =
    state.gstin.length >= 12 &&
    state.gstin.slice(2, 12).toUpperCase() === state.panNumber.toUpperCase();

  return (
    <div className="space-y-8">
      {/* Live Verification Status & Campaign Publishing Gate Banner */}
      <VerificationStatusBanner
        initialState={{
          kycStatus: state.kycStatus,
          ...(state.legalName ? { legalName: state.legalName } : {}),
          ...(state.panNumber ? { panNumber: state.panNumber } : {}),
          ...(state.isGstRegistered && state.gstin
            ? { gstin: state.gstin }
            : {}),
          ...(state.razorpayLinkedAccountId
            ? { razorpayLinkedAccountId: state.razorpayLinkedAccountId }
            : {}),
        }}
      />

      {/* Top Action Bar & Stepper Progress */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#E2E8F0] pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
            Creator KYB/KYC &amp; Razorpay Route Escrow Onboarding
          </h1>
          <p className="text-sm text-slate-600">
            Mandatory regulatory verification under Indian Intermediary &amp;
            Nodal Escrow guidelines. State is automatically persisted.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fillSampleCorporateKyc}
            className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] px-3 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-slate-100 transition-colors"
          >
            Autofill Verified D2C Sample
          </button>
          <button
            type="button"
            onClick={resetOnboardingState}
            className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-[#0F172A] transition-colors"
          >
            Reset Draft
          </button>
        </div>
      </div>

      {/* 3-Step Horizontal Architecture Indicator */}
      <nav aria-label="Onboarding progress" className="grid gap-4 sm:grid-cols-3">
        {[
          {
            step: 1 as const,
            title: "1. Entity & Identity (PAN / COI)",
            subtitle: "NSDL PAN & Incorporation Proof",
            done: state.step1Verified,
          },
          {
            step: 2 as const,
            title: "2. Tax, GSTIN & Escrow Terms",
            subtitle: "GSTN Verification & 30/40/30 Mandate",
            done: state.step2Verified,
          },
          {
            step: 3 as const,
            title: "3. Penny-Drop & Razorpay Route",
            subtitle: "IMPS BAV + Linked Account (POST /v2/accounts)",
            done: state.kycStatus === "APPROVED",
          },
        ].map((item) => {
          const isCurrent = state.currentStep === item.step;
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => {
                if (
                  item.step === 1 ||
                  (item.step === 2 && state.step1Verified) ||
                  (item.step === 3 && state.step1Verified && state.step2Verified)
                ) {
                  setErrorBanner(null);
                  updatePersistedState((prev) => ({
                    ...prev,
                    currentStep: item.step,
                  }));
                }
              }}
              className={`flex flex-col justify-between rounded-lg border p-4 text-left transition-colors ${
                isCurrent
                  ? "border-[#0F172A] bg-[#FFFFFF] ring-1 ring-[#0F172A]"
                  : item.done
                  ? "border-[#BBF7D0] bg-[#F0FDF4]/40"
                  : "border-[#E2E8F0] bg-[#FAFAFA]"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-semibold text-[#0F172A]">
                  {item.title}
                </span>
                {item.done ? (
                  <TrustBadge variant="emerald">Verified</TrustBadge>
                ) : isCurrent ? (
                  <TrustBadge variant="slate">Active</TrustBadge>
                ) : (
                  <span className="text-xs font-mono text-slate-400">
                    Locked
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-500">{item.subtitle}</span>
            </button>
          );
        })}
      </nav>

      {/* Error Alert */}
      {errorBanner && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50/80 p-4 text-xs font-medium text-red-900"
        >
          <span className="font-semibold">Compliance Validation Error: </span>
          {errorBanner}
        </div>
      )}

      {/* =====================================================================
          STEP 1: ENTITY & IDENTITY DETAILS
          ===================================================================== */}
      {state.currentStep === 1 && (
        <form
          onSubmit={handleStep1Submit}
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6"
        >
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Step 1: Legal Entity &amp; Permanent Account Number (PAN)
            </h2>
            <p className="text-xs text-slate-500">
              Your legal name and PAN must match your official NSDL record and
              settlement bank account.
            </p>
          </div>

          {/* Entity Type Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
              Legal Entity Classification
            </label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {ENTITY_OPTIONS.map((opt) => {
                const selected = state.entityType === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      updatePersistedState((prev) => ({
                        ...prev,
                        entityType: opt.value,
                        step1Verified: false,
                      }))
                    }
                    className={`rounded-md border p-3.5 text-left transition-colors ${
                      selected
                        ? "border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                        : "border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-semibold text-[#0F172A]">
                        {opt.value}
                      </span>
                      {opt.mandatoryGst ? (
                        <span className="text-[10px] font-medium text-slate-500">
                          GST &amp; CIN Mandatory
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-[#16A34A]">
                          Micro-Creator Eligible
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-semibold text-[#0F172A]">
                      {opt.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {opt.subtitle}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Legal Name */}
            <div className="space-y-1.5">
              <label
                htmlFor="legalName"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Registered Legal Name (As per PAN Card) *
              </label>
              <input
                id="legalName"
                type="text"
                required
                placeholder="e.g. Vayu Precision Hardware Private Limited"
                value={state.legalName}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    legalName: e.target.value,
                    step1Verified: false,
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            {/* PAN Number */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="panNumber"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  10-Character Income Tax PAN *
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  Regex: ^[A-Z]&#123;5&#125;[0-9]&#123;4&#125;[A-Z]&#123;1&#125;$
                </span>
              </div>
              <input
                id="panNumber"
                type="text"
                required
                maxLength={10}
                placeholder="AAACV4821C"
                value={state.panNumber}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    panNumber: e.target.value.toUpperCase(),
                    step1Verified: false,
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm uppercase text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
              {state.panNumber.length > 0 && (
                <p
                  className={`text-xs ${
                    isPanValidFormat ? "text-[#16A34A]" : "text-amber-700"
                  }`}
                >
                  {isPanValidFormat
                    ? "✓ Valid 10-character Indian PAN structure"
                    : "Must be 5 uppercase letters + 4 digits + 1 check letter"}
                </p>
              )}
            </div>
          </div>

          {/* Conditional Corporate CIN / LLPIN */}
          {isCorporateEntity && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="cinNumber"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  MCA Corporate Identification Number (CIN / LLPIN) *
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  Mandatory for PVT_LTD, OPC, and LLP
                </span>
              </div>
              <input
                id="cinNumber"
                type="text"
                required
                maxLength={21}
                placeholder="U26100KA2024PTC182910 or AAA-1234"
                value={state.cinNumber}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    cinNumber: e.target.value.toUpperCase(),
                    step1Verified: false,
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm uppercase text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>
          )}

          {/* Aadhaar / Incorporation Certificate Upload */}
          <div className="space-y-2 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <label
                  htmlFor="identityDocUpload"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  {isCorporateEntity
                    ? "Upload Certificate of Incorporation (MCA COI PDF) *"
                    : "Upload Masked Aadhaar e-KYC / Identity Proof (PDF/PNG) *"}
                </label>
                <p className="text-xs text-slate-500">
                  Stored in encrypted compliance vault. For Aadhaar, ensure the
                  first 8 digits are masked per UIDAI guidelines.
                </p>
              </div>
              {state.identityDocumentName && (
                <TrustBadge variant="emerald">
                  Attached: {state.identityDocumentName}
                </TrustBadge>
              )}
            </div>

            <input
              id="identityDocUpload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  updatePersistedState((prev) => ({
                    ...prev,
                    identityDocumentName: file.name,
                    identityDocumentSizeKb: Math.max(
                      1,
                      Math.round(file.size / 1024)
                    ),
                  }));
                }
              }}
              className="block w-full text-xs text-slate-600 file:mr-4 file:rounded-md file:border file:border-[#E2E8F0] file:bg-[#FFFFFF] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-[#0F172A] hover:file:bg-slate-50"
            />
          </div>

          {state.panVerification?.verified && (
            <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-xs text-[#16A34A] flex items-center justify-between">
              <span>
                NSDL Verification Passed: <strong>{state.panVerification.registeredName}</strong> ({state.panVerification.categoryHolderType})
              </span>
              <span className="font-mono">
                Ref: {state.panVerification.providerReferenceId}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[#E2E8F0] pt-4">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#0F172A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Verifying PAN with NSDL..."
                : "Verify PAN & Continue to Step 2 →"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          STEP 2: TAX & GST COMPLIANCE + ESCROW INTERMEDIARY AGREEMENT
          ===================================================================== */}
      {state.currentStep === 2 && (
        <form
          onSubmit={handleStep2Submit}
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6"
        >
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Step 2: GST Compliance &amp; 3-Tranche Intermediary Escrow Mandate
            </h2>
            <p className="text-xs text-slate-500">
              Verified Step 1 PAN:{" "}
              <span className="font-mono font-semibold text-[#0F172A]">
                {state.panNumber}
              </span>{" "}
              ({state.entityType})
            </p>
          </div>

          {/* GST Registration Mode Selector */}
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() =>
                updatePersistedState((prev) => ({
                  ...prev,
                  isGstRegistered: true,
                  step2Verified: false,
                }))
              }
              className={`rounded-md border p-4 text-left ${
                state.isGstRegistered
                  ? "border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                  : "border-[#E2E8F0] bg-[#FFFFFF]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Registered GST Taxpayer / Commercial D2C Brand
                </span>
                <TrustBadge variant="emerald">Standard</TrustBadge>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Mandatory for all Pvt Ltd, OPC, LLP entities and commercial
                hardware/tabletop launches claiming Input Tax Credit (ITC) on
                our 18% GST commission invoices.
              </p>
            </button>

            <button
              type="button"
              disabled={isCorporateEntity}
              onClick={() =>
                updatePersistedState((prev) => ({
                  ...prev,
                  isGstRegistered: false,
                  gstin: "",
                  step2Verified: false,
                }))
              }
              className={`rounded-md border p-4 text-left ${
                !state.isGstRegistered
                  ? "border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                  : "border-[#E2E8F0] bg-[#FFFFFF]"
              } ${isCorporateEntity ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#0F172A]">
                  Non-GST Micro-Creator Exemption
                </span>
                <TrustBadge variant="slate">
                  {isCorporateEntity
                    ? "Unavailable for Corporate"
                    : "Individual / Prop Only"}
                </TrustBadge>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                For independent comics/art creators with aggregate annual
                turnover below ₹20 Lakhs under Section 22 of the CGST Act.
              </p>
            </button>
          </div>

          {state.isGstRegistered ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="gstinInput"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  15-Character Goods &amp; Services Tax Identification Number
                  (GSTIN) *
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  Regex: ^[0-9]&#123;2&#125;[A-Z]&#123;5&#125;[0-9]&#123;4&#125;[A-Z]&#123;1&#125;[1-9A-Z]&#123;1&#125;Z[0-9A-Z]&#123;1&#125;$
                </span>
              </div>
              <input
                id="gstinInput"
                type="text"
                required
                maxLength={15}
                placeholder={`29${state.panNumber || "AAACV4821C"}1Z5`}
                value={state.gstin}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    gstin: e.target.value.toUpperCase(),
                    step2Verified: false,
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm uppercase text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
              {state.gstin.length > 0 && (
                <div className="flex flex-wrap gap-4 text-xs">
                  <span
                    className={
                      isGstinValidFormat ? "text-[#16A34A]" : "text-amber-700"
                    }
                  >
                    {isGstinValidFormat
                      ? "✓ Valid 15-character GSTIN format"
                      : "• Must be 15 chars ending with Z + check char"}
                  </span>
                  <span
                    className={
                      embeddedPanMatches ? "text-[#16A34A]" : "text-red-600"
                    }
                  >
                    {embeddedPanMatches
                      ? `✓ Embedded PAN (${state.gstin.slice(
                          2,
                          12
                        )}) matches Step 1 PAN`
                      : `• Digits 3–12 must equal Step 1 PAN (${state.panNumber})`}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <label className="flex items-start gap-3 rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-4 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={state.nonGstMicroCreatorDeclaration}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    nonGstMicroCreatorDeclaration: e.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0]"
              />
              <span>
                <strong>Section 22 CGST Micro-Creator Declaration:</strong> I
                solemnly declare that my aggregate annual turnover across India
                is below the statutory GST threshold and I am exempt from
                mandatory GST registration. I authorize the platform to deduct
                applicable Section 194-O TDS on gross campaign settlements.
              </span>
            </label>
          )}

          {/* Mandatory Intermediary Terms & 3-Tranche Escrow Agreement */}
          <div className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
                OPC Pvt Ltd Intermediary &amp; 3-Tranche Escrow Covenant
              </h3>
              <TrustBadge variant="slate">Binding Covenant</TrustBadge>
            </div>
            <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
              <li>
                <strong>All-or-Nothing Nodal Hold:</strong> 100% of backer funds
                are refunded automatically if the campaign does not reach its
                target goal by `end_date`.
              </li>
              <li>
                <strong>30% / 40% / 30% Milestone Releases:</strong> Funds are
                disbursed in 3 sequential tranches (`TRANCHE_1_30_PCT` on
                campaign success, `TRANCHE_2_40_PCT` upon production/DVT proof,
                and `TRANCHE_3_30_PCT` upon verified shipping AWB manifests).
              </li>
              <li>
                <strong>Commission &amp; Tax Withholding:</strong> Each tranche
                automatically deducts 5.00% Platform Commission + 18.00% GST on
                commission (effective 5.90%) and statutory TDS/TCS in integer
                paise.
              </li>
            </ul>

            <label className="flex items-start gap-3 pt-2 border-t border-[#E2E8F0] text-xs font-medium text-[#0F172A] cursor-pointer">
              <input
                type="checkbox"
                required
                checked={state.acceptedIntermediaryAndEscrowTerms}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    acceptedIntermediaryAndEscrowTerms: e.target.checked,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0]"
              />
              <span>
                I accept the Inspirespace OPC Pvt Ltd Intermediary Agreement and
                authorize milestone-gated 30% / 40% / 30% escrow disbursements
                via Razorpay Route. *
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() =>
                updatePersistedState((prev) => ({ ...prev, currentStep: 1 }))
              }
              className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
            >
              ← Back to Step 1
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#0F172A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Validating GSTIN & Terms..."
                : "Verify Tax Compliance & Continue to Step 3 →"}
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          STEP 3: BANK ACCOUNT, PENNY-DROP & RAZORPAY ROUTE LINKED ACCOUNT
          ===================================================================== */}
      {state.currentStep === 3 && (
        <form
          onSubmit={handleStep3Submit}
          className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 md:p-8 space-y-6"
        >
          <div className="border-b border-[#E2E8F0] pb-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">
              Step 3: Settlement Bank Account, Penny-Drop &amp; Razorpay Route
              Activation
            </h2>
            <p className="text-xs text-slate-500">
              We perform an instant IMPS ₹1.00 Penny-Drop verification and
              invoke <code>POST /v2/accounts</code> on Razorpay Route to bind
              your Linked Account.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <label
                htmlFor="accountHolderName"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Beneficiary Account Holder Name (Must match Legal Name) *
              </label>
              <input
                id="accountHolderName"
                type="text"
                required
                value={state.accountHolderName}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    accountHolderName: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="bankAccountNumber"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Bank Account Number (Current / Escrow Settlement A/c) *
              </label>
              <input
                id="bankAccountNumber"
                type="text"
                required
                placeholder="50200084910234"
                value={state.bankAccountNumber}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    bankAccountNumber: e.target.value.replace(/[^0-9]/g, ""),
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="confirmBankAccountNumber"
                className="block text-xs font-semibold text-[#0F172A]"
              >
                Confirm Bank Account Number *
              </label>
              <input
                id="confirmBankAccountNumber"
                type="text"
                required
                placeholder="50200084910234"
                value={state.confirmBankAccountNumber}
                onChange={(e) =>
                  updatePersistedState((prev) => ({
                    ...prev,
                    confirmBankAccountNumber: e.target.value.replace(
                      /[^0-9]/g,
                      ""
                    ),
                  }))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="bankIfsc"
                  className="block text-xs font-semibold text-[#0F172A]"
                >
                  11-Character RBI IFSC Code *
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  5th character is always 0
                </span>
              </div>
              <input
                id="bankIfsc"
                type="text"
                required
                maxLength={11}
                placeholder="HDFC0000240"
                value={state.bankIfsc}
                onChange={(e) => handleIfscChange(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 font-mono text-sm uppercase text-[#0F172A] focus:border-[#0F172A] focus:outline-none"
              />
            </div>

            {/* Live IFSC Branch Resolution Box */}
            <div className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-3.5 flex flex-col justify-center">
              <span className="text-[11px] font-medium uppercase text-slate-500">
                RBI NPCI Branch Directory Resolution
              </span>
              {state.ifscDetails?.valid ? (
                <div className="mt-1 space-y-0.5 text-xs">
                  <p className="font-semibold text-[#0F172A]">
                    {state.ifscDetails.bankName} — {state.ifscDetails.branchName}
                  </p>
                  <p className="text-slate-600 font-mono text-[11px]">
                    {state.ifscDetails.city}, {state.ifscDetails.state} · IMPS /
                    NEFT / RTGS Active
                  </p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-slate-500">
                  Enter a valid 11-character IFSC (e.g. <code>HDFC0000240</code>
                  ) to resolve bank branch.
                </p>
              )}
            </div>
          </div>

          {/* Penny-Drop & Razorpay Route Linked Account Provisioning Summary */}
          {state.kycStatus === "APPROVED" &&
            state.pennyDropResult &&
            state.razorpayRouteResult && (
              <div className="rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrustBadge variant="emerald">
                      PENNY-DROP &amp; RAZORPAY ROUTE VERIFIED
                    </TrustBadge>
                    <span className="font-mono text-xs text-[#0F172A]">
                      Mode: {state.razorpayRouteResult.mode}
                    </span>
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#16A34A]">
                    Linked Account: {state.razorpayLinkedAccountId}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded border border-[#BBF7D0] bg-[#FFFFFF] p-3">
                    <span className="text-slate-500 block">
                      IMPS Penny-Drop UTR
                    </span>
                    <span className="font-mono font-semibold text-[#0F172A]">
                      {state.pennyDropResult.utrNumber}
                    </span>
                  </div>
                  <div className="rounded border border-[#BBF7D0] bg-[#FFFFFF] p-3">
                    <span className="text-slate-500 block">
                      Beneficiary Name Match
                    </span>
                    <span className="font-mono font-semibold text-[#16A34A]">
                      {state.pennyDropResult.nameMatchScore}% Match (
                      {state.pennyDropResult.nameAtBank})
                    </span>
                  </div>
                  <div className="rounded border border-[#BBF7D0] bg-[#FFFFFF] p-3">
                    <span className="text-slate-500 block">
                      Razorpay Route Account ID
                    </span>
                    <span className="font-mono font-semibold text-[#0F172A]">
                      {state.razorpayLinkedAccountId}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-slate-700">
                    Your `creator_kyc.kyc_status` is now{" "}
                    <code className="font-semibold text-[#16A34A]">
                      APPROVED
                    </code>
                    . Campaign publishing is unlocked in Creator Studio.
                  </p>
                  <Link
                    href="/studio"
                    className="rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-[#FFFFFF] hover:bg-[#15803D]"
                  >
                    Return to Creator Studio →
                  </Link>
                </div>
              </div>
            )}

          <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-4">
            <button
              type="button"
              onClick={() =>
                updatePersistedState((prev) => ({ ...prev, currentStep: 2 }))
              }
              className="rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#FAFAFA]"
            >
              ← Back to Step 2
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-[#16A34A] px-5 py-2.5 text-xs font-semibold text-[#FFFFFF] hover:bg-[#15803D] disabled:opacity-50 transition-colors"
            >
              {isPending
                ? "Executing Penny-Drop & Provisioning Razorpay Route..."
                : "Execute Penny-Drop & Create Razorpay Linked Account"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

