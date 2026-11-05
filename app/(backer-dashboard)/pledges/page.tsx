import { TrustBadge } from "@/components/ui/trust-badge";
import {
  calculatePledgeCheckout,
  formatPaiseToINR,
} from "@/lib/finance/calculator";

export default function BackerPledgesPage() {
  const samplePledge = calculatePledgeCheckout(899_900n, 149_900n, 25_000n, 18);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
          My Escrowed Pledges &amp; Tax Invoices
        </h1>
        <p className="text-sm text-slate-600">
          Track milestone-locked escrow status, B2C/B2B GST invoices, and
          automatic All-or-Nothing refund guarantees.
        </p>
      </div>

      <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
          <div>
            <p className="text-xs font-mono text-slate-500">
              ORDER #rzp_order_ind_99281 · HARDWARE_IOT
            </p>
            <h2 className="text-base font-semibold text-[#0F172A]">
              Vayu-1 Open Source Air Quality &amp; VOC Telemetry Station
            </h2>
          </div>
          <TrustBadge variant="emerald">CAPTURED_IN_ESCROW</TrustBadge>
        </div>

        <div className="grid gap-4 sm:grid-cols-4 text-sm tabular-nums">
          <div className="rounded border border-[#E2E8F0] bg-[#FAFAFA] p-3">
            <span className="text-xs text-slate-500 block">
              Base Reward Tier
            </span>
            <span className="font-semibold">
              {formatPaiseToINR(samplePledge.baseAmountPaise)}
            </span>
          </div>
          <div className="rounded border border-[#E2E8F0] bg-[#FAFAFA] p-3">
            <span className="text-xs text-slate-500 block">Add-ons</span>
            <span className="font-semibold">
              {formatPaiseToINR(samplePledge.addonsAmountPaise)}
            </span>
          </div>
          <div className="rounded border border-[#E2E8F0] bg-[#FAFAFA] p-3">
            <span className="text-xs text-slate-500 block">
              Embedded GST (18%)
            </span>
            <span className="font-semibold">
              {formatPaiseToINR(samplePledge.embeddedRewardGstPaise)}
            </span>
          </div>
          <div className="rounded border border-[#E2E8F0] bg-[#FAFAFA] p-3">
            <span className="text-xs text-slate-500 block">
              Total Locked in Escrow
            </span>
            <span className="font-semibold text-[#16A34A]">
              {formatPaiseToINR(samplePledge.totalPaidPaise)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

