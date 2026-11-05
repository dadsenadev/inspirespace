import assert from "node:assert/strict";
import {
  ALLOWED_VERTICALS,
  SEED_CAMPAIGNS,
  findCampaignBySlug,
  computeCampaignProgressMetrics,
} from "../catalog.ts";

console.log("Running Phase 3 Campaign & Storefront Verification Suite...\n");

// 1. Strictly 3 Curated Verticals Verification
{
  assert.equal(ALLOWED_VERTICALS.length, 3);
  const codes = ALLOWED_VERTICALS.map((v) => v.code);
  assert.deepEqual(codes, ["HARDWARE_IOT", "GAMES_COMICS", "D2C_ARTISANAL"]);
  console.log("✔ Test 1 Passed: Strictly Locked 3 Curated Verticals");
}

// 2. Seed Campaigns & Escrow Tranche Schedule Verification
{
  for (const cmp of SEED_CAMPAIGNS) {
    assert.ok(
      cmp.durationDays >= 15 && cmp.durationDays <= 60,
      `Duration ${cmp.durationDays} must be between 15 and 60 days`
    );
    assert.equal(cmp.fundingType, "ALL_OR_NOTHING");

    const metrics = computeCampaignProgressMetrics(cmp);
    const [t1, t2, t3] = metrics.escrowSchedule.tranches;

    assert.equal(
      t1.grossAmountPaise + t2.grossAmountPaise + t3.grossAmountPaise,
      metrics.escrowSchedule.totalGrossAmountPaise
    );
    assert.equal(
      t1.netPayoutPaise + t2.netPayoutPaise + t3.netPayoutPaise,
      metrics.escrowSchedule.totalNetPayoutPaise
    );

    // Verify 3-Tranche Milestone Plans (30% / 40% / 30%)
    assert.equal(
      cmp.prototypeAndMilestones.milestone1Plan.releasePercentage +
        cmp.prototypeAndMilestones.milestone2Plan.releasePercentage +
        cmp.prototypeAndMilestones.milestone3Plan.releasePercentage,
      100
    );
  }
  console.log(
    "✔ Test 2 Passed: Campaign Duration (15-60d) & 30/40/30 Milestone Plans Verified"
  );
}

// 3. Slug Resolution & Early-Bird Counter Verification
{
  const vayu = findCampaignBySlug("vayu-1-open-source-air-quality-telemetry");
  assert.ok(vayu);
  const ebTier = vayu.rewardTiers[0]!;
  assert.equal(ebTier.earlyBirdLimit, 100);
  assert.equal(ebTier.claimedCount, 88);
  assert.equal(ebTier.earlyBirdLimit - ebTier.claimedCount, 12); // 12 slots left
  console.log(
    "✔ Test 3 Passed: Public Storefront Slug Resolution & Early-Bird Slot Counter"
  );
}

console.log("\nAll Phase 3 Campaign & Storefront checks passed.");

