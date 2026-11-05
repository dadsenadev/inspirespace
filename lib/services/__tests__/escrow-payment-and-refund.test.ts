import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  resolveStateFromPincode,
  validateIndianShippingAddress,
  reserveEarlyBirdSlotAtomic,
  resetSlotReservationsForTesting,
  createRazorpayEscrowOrder,
  verifyRazorpayWebhookSignature,
  processPaymentCapturedWebhook,
  evaluateExpiredCampaigns,
  getInMemoryLedgerEntries,
  getInMemoryPledgeByOrderId,
} from "../escrow-payment-service.ts";
import { SEED_CAMPAIGNS } from "../../campaigns/catalog.ts";

console.log(
  "Running Phase 4 Escrow Payment, Webhook Ledger & Refund Engine Suite...\n"
);

// 1. Indian PIN Code & Shipping Address Validation
{
  const blr = resolveStateFromPincode("560038");
  assert.equal(blr.valid, true);
  assert.equal(blr.state, "Karnataka");
  assert.equal(blr.gstStateCode, "29");

  const mum = resolveStateFromPincode("400001");
  assert.equal(mum.valid, true);
  assert.equal(mum.state, "Maharashtra");
  assert.equal(mum.gstStateCode, "27");

  const invalidPin = resolveStateFromPincode("056001");
  assert.equal(invalidPin.valid, false);

  const addrCheck = validateIndianShippingAddress({
    recipientName: "Aarav Sharma",
    phone: "9845098450",
    addressLine1: "Flat 402, 100 Feet Road, Indiranagar",
    city: "Bengaluru",
    state: "Karnataka",
    stateCode: "29",
    pincode: "560038",
    country: "India",
  });
  assert.equal(addrCheck.valid, true);

  console.log(
    "✔ Test 1 Passed: Indian PIN Code & GST Place-of-Supply Validation"
  );
}

// 2. Concurrent Early-Bird Atomic Slot Reservation (Zero Overbooking Test)
{
  resetSlotReservationsForTesting();

  // Suppose a tier has earlyBirdLimit = 100 and baseClaimedCount = 97 (only 3 slots left)
  const concurrentAttempts = Array.from({ length: 20 }, (_, i) =>
    reserveEarlyBirdSlotAtomic({
      tierId: "tier_concurrency_test",
      backerId: `backer_${i + 1}`,
      earlyBirdLimit: 100,
      baseClaimedCount: 97,
    })
  );

  const results = await Promise.all(concurrentAttempts);
  const succeeded = results.filter((r) => r.reserved);
  const rejected = results.filter((r) => !r.reserved);

  assert.equal(
    succeeded.length,
    3,
    "Strictly 3 slots should be reserved when 97 of 100 are already claimed"
  );
  assert.equal(
    rejected.length,
    17,
    "Remaining 17 concurrent checkouts must be blocked from overbooking"
  );
  assert.ok(
    rejected.every((r) => r.error?.startsWith("EARLY_BIRD_SOLD_OUT"))
  );

  resetSlotReservationsForTesting();
  console.log(
    "✔ Test 2 Passed: Atomic Early-Bird Slot Reservation (20 Concurrent Checkouts, 0 Overbooked)"
  );
}

// 3. Razorpay Order Creation, HMAC-SHA256 Webhook Verification & Double-Entry Capture
{
  const vayuCampaign = SEED_CAMPAIGNS[0]!;
  const initialCampaignPledged = vayuCampaign.pledgedAmountPaise;
  const initialBackerCount = vayuCampaign.backerCount;
  const initialTierClaimed = vayuCampaign.rewardTiers[0]!.claimedCount;

  const orderRes = await createRazorpayEscrowOrder({
    campaignSlugOrId: vayuCampaign.slug,
    tierId: vayuCampaign.rewardTiers[0]!.id, // ₹7,999.00 + ₹150.00 shipping
    addonIds: [vayuCampaign.addons[0]!.id], // +₹1,299.00 brass desk stand
    backerId: "00000000-0000-4000-8000-000000000501",
    backerEmail: "aarav@inspirespace.in",
    ShippingAddress: {
      recipientName: "Aarav Sharma",
      phone: "9845098450",
      addressLine1: "Flat 402, 100 Feet Road, Indiranagar",
      city: "Bengaluru",
      state: "Karnataka",
      stateCode: "29",
      pincode: "560038",
      country: "India",
    },
  });

  assert.equal(orderRes.success, true);
  assert.ok(orderRes.razorpayOrderId);
  // 799,900 + 129,900 + 15,000 = 944,800 paise (₹9,448.00)
  assert.equal(orderRes.amountPaiseStr, "944800");

  // Verify HMAC-SHA256 signature validation
  const secret = "rzp_webhook_secret_test_key";
  const rawPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_RzpTest99001",
          order_id: orderRes.razorpayOrderId,
          amount: 944800,
          currency: "INR",
          status: "captured",
          method: "upi",
        },
      },
    },
  });

  const validSig = crypto
    .createHmac("sha256", secret)
    .update(rawPayload)
    .digest("hex");

  assert.equal(
    verifyRazorpayWebhookSignature(rawPayload, validSig, secret),
    true
  );
  assert.equal(
    verifyRazorpayWebhookSignature(rawPayload, "deadbeef0000", secret),
    false
  );
  assert.equal(
    verifyRazorpayWebhookSignature(rawPayload + " ", validSig, secret),
    false
  );

  // Process `payment.captured`
  const captureRes = await processPaymentCapturedWebhook({
    razorpayOrderId: orderRes.razorpayOrderId!,
    razorpayPaymentId: "pay_RzpTest99001",
    amountCapturedPaise: 944_800n,
    paymentMethod: "upi",
  });

  assert.equal(captureRes.success, true);
  assert.equal(captureRes.newPledgeStatus, "CAPTURED_IN_ESCROW");
  assert.equal(
    captureRes.ledgerEntry?.debitAccount,
    "GATEWAY_ESCROW_RECEIVABLE"
  );
  assert.equal(
    captureRes.ledgerEntry?.creditAccount,
    "CAMPAIGN_ESCROW_LIABILITY"
  );
  assert.equal(captureRes.ledgerEntry?.amountPaise, 944_800n);

  // Verify atomic increments on campaign & reward tier
  assert.equal(
    vayuCampaign.pledgedAmountPaise,
    initialCampaignPledged + 944_800n
  );
  assert.equal(vayuCampaign.backerCount, initialBackerCount + 1);
  assert.equal(
    vayuCampaign.rewardTiers[0]!.claimedCount,
    initialTierClaimed + 1
  );

  // Verify idempotency on duplicate webhook delivery
  const duplicateRes = await processPaymentCapturedWebhook({
    razorpayOrderId: orderRes.razorpayOrderId!,
    razorpayPaymentId: "pay_RzpTest99001",
    amountCapturedPaise: 944_800n,
  });
  assert.equal(duplicateRes.success, true);
  assert.equal(duplicateRes.alreadyProcessed, true);
  assert.equal(vayuCampaign.backerCount, initialBackerCount + 1); // Not double-counted!

  const storedPledge = getInMemoryPledgeByOrderId(orderRes.razorpayOrderId!);
  assert.equal(storedPledge?.status, "CAPTURED_IN_ESCROW");

  console.log(
    "✔ Test 3 Passed: Razorpay Order, HMAC-SHA256 Webhook, Atomic Increments & GATEWAY_ESCROW_RECEIVABLE -> CAMPAIGN_ESCROW_LIABILITY Ledger Entry"
  );
}

// 4. Campaign Expiry Cron Evaluation (SUCCESSFUL Tranche 1 Unlock & FAILED_REFUNDING Batch Refunds)
{
  const evalResult = await evaluateExpiredCampaigns({
    referenceNow: new Date("2026-12-01T00:00:00.000Z"),
    candidatesOverride: [
      {
        campaignId: "cmp_success_eval_01",
        title: "Succeeded Hardware Batch Launch",
        endDateIso: "2026-11-25T23:59:59.000Z",
        goalAmountPaise: 100_000_000n, // ₹10,00,000.00
        pledgedAmountPaise: 120_000_000n, // ₹12,00,000.00 (120% funded)
        status: "LIVE",
        capturedPledges: [],
      },
      {
        campaignId: "cmp_failed_eval_02",
        title: "Under-Goal Indie Comic Launch",
        endDateIso: "2026-11-20T23:59:59.000Z",
        goalAmountPaise: 100_000_000n, // ₹10,00,000.00
        pledgedAmountPaise: 45_000_000n, // ₹4,50,000.00 (45% funded -> Must Refund!)
        status: "LIVE",
        capturedPledges: [
          {
            pledgeId: "00000000-0000-4000-8000-000000000901",
            backerId: "00000000-0000-4000-8000-000000000801",
            totalPaidPaise: 25_000_000n,
            razorpayPaymentId: "pay_FailedCmp001",
          },
          {
            pledgeId: "00000000-0000-4000-8000-000000000902",
            backerId: "00000000-0000-4000-8000-000000000802",
            totalPaidPaise: 20_000_000n,
            razorpayPaymentId: "pay_FailedCmp002",
          },
        ],
      },
    ],
  });

  assert.equal(evalResult.outcomes.length, 2);

  // Outcome 1: SUCCESSFUL + TRANCHE_1_30_PCT unlocked
  const successOutcome = evalResult.outcomes[0]!;
  assert.equal(successOutcome.newStatus, "SUCCESSFUL");
  assert.equal(
    successOutcome.tranche1Unlocked?.trancheNumber,
    "TRANCHE_1_30_PCT"
  );
  // 30% of 120,000,000 paise = 36,000,000 paise gross
  assert.equal(successOutcome.tranche1Unlocked?.grossAmountPaiseStr, "36000000");

  // Outcome 2: FAILED_REFUNDING + Batch Refunds + Reversal Ledger Entries
  const failedOutcome = evalResult.outcomes[1]!;
  assert.equal(failedOutcome.newStatus, "FAILED_REFUNDING");
  assert.equal(failedOutcome.refundSummary?.totalPledgesRefunded, 2);
  assert.equal(failedOutcome.refundSummary?.totalRefundedPaiseStr, "45000000");

  const ledgerEntries = getInMemoryLedgerEntries();
  const refundLedgerLines = ledgerEntries.filter(
    (l) => l.referenceType === "PLEDGE_REFUND"
  );
  assert.equal(refundLedgerLines.length, 2);
  assert.equal(
    refundLedgerLines[0]!.debitAccount,
    "CAMPAIGN_ESCROW_LIABILITY"
  );
  assert.equal(
    refundLedgerLines[0]!.creditAccount,
    "GATEWAY_ESCROW_RECEIVABLE"
  );

  console.log(
    "✔ Test 4 Passed: Campaign Expiry Cron (SUCCESSFUL Tranche 1 Unlock & FAILED_REFUNDING Batch Refunds + Ledger Reversals)"
  );
}

console.log("\nAll Phase 4 Escrow Payment, Ledger & Refund tests passed.");

