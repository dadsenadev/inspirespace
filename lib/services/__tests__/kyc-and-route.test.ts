import assert from "node:assert/strict";
import {
  getKycVerificationService,
  PAN_REGEX,
  GSTIN_REGEX,
  IFSC_REGEX,
  doesGstinMatchPan,
} from "../kyc-service.ts";

console.log("Running Phase 2 KYB/KYC & Razorpay Route Verification Suite...\n");

const kycService = getKycVerificationService("SANDBOX");

// 1. PAN Regex & Verification
{
  assert.equal(PAN_REGEX.test("ABCDE1234F"), true);
  assert.equal(PAN_REGEX.test("abcde1234f"), false);
  assert.equal(PAN_REGEX.test("ABCD12345F"), false);

  const validPan = await kycService.verifyPan(
    "AAACI1234C",
    "Vayu Precision Hardware Pvt Ltd",
    "PVT_LTD"
  );
  assert.equal(validPan.verified, true);
  assert.equal(validPan.panNumber, "AAACI1234C");

  const invalidPan = await kycService.verifyPan(
    "ZZZZZ9999Z",
    "Invalid Entity",
    "INDIVIDUAL"
  );
  assert.equal(invalidPan.verified, false);
  console.log("✔ Test 1 Passed: PAN Regex & Sandbox NSDL Adapter Verification");
}

// 2. GSTIN Regex & Embedded PAN Cross-Check
{
  assert.equal(GSTIN_REGEX.test("29AAACI1234C1Z5"), true);
  assert.equal(GSTIN_REGEX.test("29AAACI1234C1A5"), false); // 14th char must be Z
  assert.equal(doesGstinMatchPan("29AAACI1234C1Z5", "AAACI1234C"), true);
  assert.equal(doesGstinMatchPan("29BBBBB1234C1Z5", "AAACI1234C"), false);

  const validGstin = await kycService.verifyGstin(
    "29AAACI1234C1Z5",
    "AAACI1234C"
  );
  assert.equal(validGstin.verified, true);
  assert.equal(validGstin.stateJurisdiction, "Karnataka");

  const mismatchedGstin = await kycService.verifyGstin(
    "27ZZZZZ1234F1Z2",
    "AAACI1234C"
  );
  assert.equal(mismatchedGstin.verified, false);
  console.log(
    "✔ Test 2 Passed: GSTIN Format & Embedded PAN Cross-Verification"
  );
}

// 3. IFSC & Bank Account Penny-Drop Verification
{
  assert.equal(IFSC_REGEX.test("HDFC0000123"), true);
  assert.equal(IFSC_REGEX.test("HDFC1000123"), false); // 5th char must be 0

  const ifscRes = await kycService.verifyIfsc("HDFC0000123");
  assert.equal(ifscRes.valid, true);
  assert.equal(ifscRes.bankName, "HDFC Bank Ltd");

  const pennyDropRes = await kycService.verifyBankPennyDrop({
    accountHolderName: "Vayu Precision Hardware Pvt Ltd",
    bankAccountNumber: "50200012345678",
    bankIfsc: "HDFC0000123",
  });
  assert.equal(pennyDropRes.verified, true);
  assert.equal(pennyDropRes.accountExists, true);
  assert.ok(pennyDropRes.utrNumber.length > 0);
  assert.equal(pennyDropRes.nameMatchScore, 100);

  const failedPennyDrop = await kycService.verifyBankPennyDrop({
    accountHolderName: "Vayu Precision Hardware Pvt Ltd",
    bankAccountNumber: "000000000000",
    bankIfsc: "HDFC0000123",
  });
  assert.equal(failedPennyDrop.verified, false);
  console.log(
    "✔ Test 3 Passed: IFSC Lookup & Bank Penny-Drop (IMPS BAV) Verification"
  );
}

console.log("\nAll Phase 2 KYC service adapter checks passed.");

