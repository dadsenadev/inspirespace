import {
  calculateEscrowTrancheSchedule,
  buildTrancheReleaseLedgerEntries,
  formatPaiseToINR,
} from "@/lib/finance/calculator";
import { TrustBadge } from "@/components/ui/trust-badge";

export default function AdminCompliancePage() {
  const schedule = calculateEscrowTrancheSchedule(100_000_000n, {
    tdsTcsRateBps: 60n, // 0.1% Sec 194-O TDS + 0.5% Sec 52 CGST TCS
  });
  const t1Entries = buildTrancheReleaseLedgerEntries({
    trancheId: "c1b2a3d4-0001-4000-8000-000000000001",
    campaignId: "a1b2c3d4-0001-4000-8000-000000000001",
    tranche: schedule.tranches[0],
    razorpayTransferId: "trf_RzpRouteInd001",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A]">
          Compliance &amp; Double-Entry Ledger Inspector
        </h1>
        <p className="text-sm text-slate-600">
          Append-only PostgreSQL audit trail (`ledger_entries`) enforcing zero
          paise drift across nodal escrow, GST liability, TDS/TCS, and creator
          settlements.
        </p>
      </div>

      <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Sample Tranche 1 (`TRANCHE_1_30_PCT`) Double-Entry Postings
          </h2>
          <TrustBadge variant="emerald">Trigger Protected: Append-Only</TrustBadge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs tabular-nums">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#FAFAFA] font-medium uppercase text-slate-500">
                <th className="py-2.5 px-3">Reference Type</th>
                <th className="py-2.5 px-3">Debit Account</th>
                <th className="py-2.5 px-3">Credit Account</th>
                <th className="py-2.5 px-3 text-right">Amount (Paise)</th>
                <th className="py-2.5 px-3 text-right">Amount (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] font-mono">
              {t1Entries.map((entry, idx) => (
                <tr key={idx}>
                  <td className="py-2.5 px-3">{entry.referenceType}</td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {entry.debitAccount}
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">
                    {entry.creditAccount}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {entry.amountPaise.toString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-sans font-semibold text-[#0F172A]">
                    {formatPaiseToINR(entry.amountPaise)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

