"use client";

import * as React from "react";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";

export type KycVerificationStatus =
  | "DRAFT"
  | "PENDING_VERIFICATION"
  | "APPROVED"
  | "REJECTED";

export interface PersistedKycSummary {
  kycStatus: KycVerificationStatus;
  legalName?: string;
  entityType?: string;
  panNumber?: string;
  gstin?: string;
  razorpayLinkedAccountId?: string;
  verifiedAtIso?: string;
}

export const KYC_STORAGE_KEY = "inspirespace_creator_kyc_v1";

export interface VerificationStatusBannerProps {
  initialState?: PersistedKycSummary;
  showPublishGateAction?: boolean;
}

export function VerificationStatusBanner({
  initialState,
  showPublishGateAction = true,
}: VerificationStatusBannerProps) {
  const [state, setState] = React.useState<PersistedKycSummary>(
    initialState ?? {
      kycStatus: "DRAFT",
    }
  );

  React.useEffect(() => {
    const syncFromStorage = () => {
      try {
        const raw = window.localStorage.getItem(KYC_STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<PersistedKycSummary>;
        if (parsed.kycStatus) {
          setState({
            kycStatus: parsed.kycStatus,
            ...(parsed.legalName ? { legalName: parsed.legalName } : {}),
            ...(parsed.entityType ? { entityType: parsed.entityType } : {}),
            ...(parsed.panNumber ? { panNumber: parsed.panNumber } : {}),
            ...(parsed.gstin ? { gstin: parsed.gstin } : {}),
            ...(parsed.razorpayLinkedAccountId
              ? { razorpayLinkedAccountId: parsed.razorpayLinkedAccountId }
              : {}),
            ...(parsed.verifiedAtIso
              ? { verifiedAtIso: parsed.verifiedAtIso }
              : {}),
          });
        }
      } catch {
        // Ignore storage parse errors
      }
    };

    syncFromStorage();
    window.addEventListener("inspirespace-kyc-updated", syncFromStorage);
    window.addEventListener("storage", syncFromStorage);
    return () => {
      window.removeEventListener("inspirespace-kyc-updated", syncFromStorage);
      window.removeEventListener("storage", syncFromStorage);
    };
  }, []);

  const isApproved =
    state.kycStatus === "APPROVED" && Boolean(state.razorpayLinkedAccountId);

  return (
    <div
      className={
        isApproved
          ? "rounded-lg border border-[#BBF7D0] bg-[#F0FDF4]/60 p-5"
          : "rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-5"
      }
    >
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            {isApproved ? (
              <TrustBadge variant="emerald">
                KYC_STATUS: APPROVED · ESCROW READY
              </TrustBadge>
            ) : state.kycStatus === "REJECTED" ? (
              <TrustBadge variant="amber">
                KYC_STATUS: REJECTED · ACTION REQUIRED
              </TrustBadge>
            ) : state.kycStatus === "PENDING_VERIFICATION" ? (
              <TrustBadge variant="amber">
                KYC_STATUS: PENDING_VERIFICATION
              </TrustBadge>
            ) : (
              <TrustBadge variant="slate">
                KYC_STATUS: {state.kycStatus} · PUBLISHING LOCKED
              </TrustBadge>
            )}

            {state.panNumber && (
              <span className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-0.5 font-mono text-xs text-slate-700">
                PAN: {state.panNumber}
              </span>
            )}

            {state.gstin && (
              <span className="rounded border border-[#E2E8F0] bg-[#FFFFFF] px-2 py-0.5 font-mono text-xs text-slate-700">
                GSTIN: {state.gstin}
              </span>
            )}

            {state.razorpayLinkedAccountId && (
              <span className="rounded border border-[#BBF7D0] bg-[#FFFFFF] px-2 py-0.5 font-mono text-xs font-medium text-[#16A34A]">
                ROUTE ID: {state.razorpayLinkedAccountId}
              </span>
            )}
          </div>

          <h2 className="text-sm font-semibold text-[#0F172A]">
            {isApproved
              ? `Verified Legal Intermediary Counterparty: ${
                  state.legalName ?? "Approved Creator"
                }`
              : "Campaign Publishing Gate: Mandatory Indian KYB/KYC & Razorpay Route Linked Account Required"}
          </h2>

          <p className="text-xs text-slate-600 leading-relaxed">
            {isApproved
              ? "Your PAN, GST compliance, and Bank Penny-Drop verification are complete. Your Razorpay Route Linked Account is active for 30% / 40% / 30% milestone escrow transfers."
              : "Under RBI nodal intermediary & GST regulations, no creator can publish a campaign or collect pre-order pledges until PAN, GST declaration, Bank Penny-Drop, and a Razorpay Route Linked Account are verified (`kyc_status === 'APPROVED'`)."}
          </p>
        </div>

        {showPublishGateAction && (
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#0F172A] hover:bg-[#FAFAFA] transition-colors"
            >
              {isApproved ? "View KYB/KYC Certificate" : "Complete KYB/KYC Onboarding →"}
            </Link>

            <button
              type="button"
              disabled={!isApproved}
              title={
                isApproved
                  ? "Publish campaign to live All-or-Nothing escrow"
                  : "Locked until kyc_status === 'APPROVED'"
              }
              className={
                isApproved
                  ? "inline-flex items-center gap-2 rounded-md bg-[#16A34A] px-4 py-2 text-xs font-semibold text-[#FFFFFF] shadow-sm hover:bg-[#15803D] transition-colors"
                  : "inline-flex cursor-not-allowed items-center gap-2 rounded-md border border-[#E2E8F0] bg-slate-100 px-4 py-2 text-xs font-medium text-slate-400"
              }
            >
              <span aria-hidden="true">{isApproved ? "✓" : "🔒"}</span>
              {isApproved
                ? "Publish Campaign (Unlocked)"
                : "Publish Campaign (Locked — KYC Pending)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

