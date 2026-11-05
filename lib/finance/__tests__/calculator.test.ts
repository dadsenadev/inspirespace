import assert from "node:assert/strict";
import {
  calculateEscrowTrancheSchedule,
  calculatePlatformFeePaise,
  calculateGstOnFeePaise,
  calculatePledgeCheckout,
  buildTrancheReleaseLedgerEntries,
  formatPaiseToINR,
  LEDGER_ACCOUNTS,
} from "../calculator.ts";

console.log("Running Inspirespace Financial Engine Verification Suite...\n");

// 1. Standard ₹10,00,000.00 (10 Lakh INR = 100,000,000 paise) Campaign Test
{
  const grossPaise = 100_000_000n; // ₹10,00,000.00
  const schedule = calculateEscrowTrancheSchedule(grossPaise, {
    tdsTcsRateBps: 0n,
  });

  // 5% of 10,00,000 = ₹50,000.00 (5,000,000 paise)
  assert.equal(schedule.totalPlatformFeePaise, 5_000_000n);
  // 18% GST on ₹50,000 = ₹9,000.00 (900,000 paise)
  assert.equal(schedule.totalGstOnFeePaise, 900_000n);
  // Net Payout = ₹10,00,000 - ₹59,000 = ₹9,41,000.00 (94,100,000 paise)
  assert.equal(schedule.totalNetPayoutPaise, 94_100_000n);

  const [t1, t2, t3] = schedule.tranches;
  // T1 (30%): Gross ₹3,00,000, Fee ₹15,000, GST ₹2,700, Net ₹2,82,300
  assert.equal(t1.grossAmountPaise, 30_000_000n);
  assert.equal(t1.platformFeePaise, 1_500_000n);
  assert.equal(t1.gstOnFeePaise, 270_000n);
  assert.equal(t1.netPayoutPaise, 28_230_000n);

  // T2 (40%): Gross ₹4,00,000, Fee ₹20,000, GST ₹3,600, Net ₹3,76,400
  assert.equal(t2.grossAmountPaise, 40_000_000n);
  assert.equal(t2.platformFeePaise, 2_000_000n);
  assert.equal(t2.gstOnFeePaise, 360_000n);
  assert.equal(t2.netPayoutPaise, 37_640_000n);

  // T3 (30%): Gross ₹3,00,000, Fee ₹15,000, GST ₹2,700, Net ₹2,82,300
  assert.equal(t3.grossAmountPaise, 30_000_000n);
  assert.equal(t3.platformFeePaise, 1_500_000n);
  assert.equal(t3.gstOnFeePaise, 270_000n);
  assert.equal(t3.netPayoutPaise, 28_230_000n);

  console.log("✔ Test 1 Passed: Exact ₹10,00,000.00 30%/40%/30% Tranche Split");
}

// 2. Exhaustive Zero-Drift Property Check across 25,000 Prime, Odd, and Boundary Paise Values
{
  const testAmounts: bigint[] = [
    1n,
    2n,
    3n,
    7n,
    11n,
    13n,
    17n,
    19n,
    23n,
    99n,
    100n,
    101n,
    999_999n,
    1_000_001n,
    99_999_999n, // ₹9,99,999.99
    123_456_789n, // ₹12,34,567.89
    9_876_543_211n, // ₹9,87,65,432.11
  ];

  // Add 10,000 sequential values around an awkward prime number to test every remainder class mod 10,000
  for (let i = 10_000_000n; i < 10_010_000n; i++) {
    testAmounts.push(i);
  }

  for (const gross of testAmounts) {
    for (const tdsBps of [0n, 10n, 60n, 100n]) {
      const schedule = calculateEscrowTrancheSchedule(gross, {
        tdsTcsRateBps: tdsBps,
      });
      const [t1, t2, t3] = schedule.tranches;

      // Vertical Sum Invariants (Zero Drift across Tranches)
      assert.equal(
        t1.grossAmountPaise + t2.grossAmountPaise + t3.grossAmountPaise,
        schedule.totalGrossAmountPaise,
        `Gross drift for ${gross}`
      );
      assert.equal(
        t1.platformFeePaise + t2.platformFeePaise + t3.platformFeePaise,
        schedule.totalPlatformFeePaise,
        `Fee drift for ${gross}`
      );
      assert.equal(
        t1.gstOnFeePaise + t2.gstOnFeePaise + t3.gstOnFeePaise,
        schedule.totalGstOnFeePaise,
        `GST drift for ${gross}`
      );
      assert.equal(
        t1.tdsTcsDeductedPaise +
          t2.tdsTcsDeductedPaise +
          t3.tdsTcsDeductedPaise,
        schedule.totalTdsTcsDeductedPaise,
        `TDS/TCS drift for ${gross}`
      );
      assert.equal(
        t1.netPayoutPaise + t2.netPayoutPaise + t3.netPayoutPaise,
        schedule.totalNetPayoutPaise,
        `Net payout vertical drift for ${gross}`
      );

      // Horizontal Per-Tranche Invariants (Matches DB CHECK constraint chk_escrow_tranches_net_payout_invariant)
      for (const t of schedule.tranches) {
        assert.equal(
          t.netPayoutPaise,
          t.grossAmountPaise -
            t.platformFeePaise -
            t.gstOnFeePaise -
            t.tdsTcsDeductedPaise,
          `Horizontal invariant failed on ${t.trancheNumber} for ${gross}`
        );
      }
    }
  }

  console.log(
    `✔ Test 2 Passed: Exhaustive Zero-Drift Invariant across ${testAmounts.length * 4} Tranche Schedules`
  );
}

// 3. Double-Entry Ledger Balance Verification
{
  const schedule = calculateEscrowTrancheSchedule(57_543_219n, {
    tdsTcsRateBps: 60n, // 0.1% TDS + 0.5% TCS
  });

  for (const tranche of schedule.tranches) {
    const entries = buildTrancheReleaseLedgerEntries({
      trancheId: "00000000-0000-0000-0000-000000000001",
      campaignId: "00000000-0000-0000-0000-000000000002",
      tranche,
      razorpayTransferId: "trf_test_12345",
    });

    // Verify that CREATOR_PAYABLE nets to exactly 0n after tranche release
    let creatorPayableCredits = 0n;
    let creatorPayableDebits = 0n;
    for (const entry of entries) {
      if (entry.creditAccount === LEDGER_ACCOUNTS.CREATOR_PAYABLE) {
        creatorPayableCredits += entry.amountPaise;
      }
      if (entry.debitAccount === LEDGER_ACCOUNTS.CREATOR_PAYABLE) {
        creatorPayableDebits += entry.amountPaise;
      }
    }

    assert.equal(
      creatorPayableCredits,
      tranche.grossAmountPaise,
      "Creator payable credit must equal tranche gross"
    );
    assert.equal(
      creatorPayableDebits,
      tranche.grossAmountPaise,
      "Creator payable debits (fee + gst + tds + net payout) must equal tranche gross"
    );
  }

  console.log(
    "✔ Test 3 Passed: Double-Entry Ledger Clearing & Zero-Balance Verification"
  );
}

// 4. Pledge Checkout & Formatting Verification
{
  const checkout = calculatePledgeCheckout(499_900n, 50_000n, 15_000n, 18);
  assert.equal(checkout.totalPaidPaise, 564_900n);
  assert.equal(
    checkout.embeddedRewardGstPaise + checkout.netPreTaxRewardPaise,
    549_900n
  );
  assert.equal(formatPaiseToINR(100_000_000n), "₹10,00,000.00");
  console.log(
    "✔ Test 4 Passed: Pledge Checkout & Indian Rupee (Lakhs/Crores) Formatting"
  );
}

console.log("\nAll financial calculation tests passed with 0 paise drift.");

