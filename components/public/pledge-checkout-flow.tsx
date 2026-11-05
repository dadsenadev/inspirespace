"use client";

import * as React from "react";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  calculatePledgeCheckout,
  formatPaiseToINR,
} from "@/lib/finance/calculator";
import {
  INDIAN_PINCODE_REGEX,
  INDIAN_MOBILE_REGEX,
  BACKER_GSTIN_REGEX,
  resolveStateFromPincode,
} from "@/lib/services/escrow-payment-service";
import type {
  SerializableRewardTier,
  SerializableAddon,
} from "@/components/public/project-tier-selector";

export interface PledgeCheckoutFlowProps {
  campaignId: string;
  campaignSlug: string;
  campaignTitle: string;
  creatorLegalName: string;
  creatorGstin: string;
  tiers: SerializableRewardTier[];
  addons: SerializableAddon[];
  initialTierId?: string;
  initialAddonIds?: string[];
}

type PaymentMethodPreference = "upi" | "card" | "netbanking";

interface OrderConfirmationState {
  pledgeId: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  reservationId?: string;
  remainingEarlyBirdSlots?: number | null;
  totalPaidPaiseStr: string;
  status: "INITIATED" | "CAPTURED_IN_ESCROW";
  ledgerDebitAccount?: string;
  ledgerCreditAccount?: string;
}

export function PledgeCheckoutFlow({
  campaignSlug,
  campaignTitle,
  creatorLegalName,
  creatorGstin,
  tiers,
  addons,
  initialTierId,
  initialAddonIds = [],
}: PledgeCheckoutFlowProps) {
  const [selectedTierId, setSelectedTierId] = React.useState<string>(
    initialTierId && tiers.some((t) => t.id === initialTierId)
      ? initialTierId
      : tiers[0]?.id ?? ""
  );
  const [selectedAddonIds, setSelectedAddonIds] =
    React.useState<string[]>(initialAddonIds);
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethodPreference>("upi");

  // Indian Shipping Address State
  const [recipientName, setRecipientName] = React.useState("Aarav Sharma");
  const [phone, setPhone] = React.useState("9845098450");
  const [addressLine1, setAddressLine1] = React.useState(
    "Flat 402, Indiranagar 100 Feet Road, HAL 2nd Stage"
  );
  const [landmark, setLandmark] = React.useState("Near Indiranagar Metro");
  const [city, setCity] = React.useState("Bengaluru");
  const [pincode, setPincode] = React.useState("560038");
  const [backerGstin, setBackerGstin] = React.useState("");

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorBanner, setErrorBanner] = React.useState<string | null>(null);
  const [orderState, setOrderState] =
    React.useState<OrderConfirmationState | null>(null);

  const selectedTier =
    tiers.find((t) => t.id === selectedTierId) ?? tiers[0];

  const pincodeResolution = resolveStateFromPincode(pincode.trim());
  const isPincodeValid = INDIAN_PINCODE_REGEX.test(pincode.trim());
  const isPhoneValid = INDIAN_MOBILE_REGEX.test(
    phone.replace(/[^0-9]/g, "").slice(-10)
  );
  const isBackerGstinValid =
    !backerGstin.trim() ||
    BACKER_GSTIN_REGEX.test(backerGstin.trim().toUpperCase());

  const baseAmountPaise = selectedTier
    ? BigInt(selectedTier.pricePaiseStr)
    : 100n;
  const shippingAmountPaise = selectedTier
    ? BigInt(selectedTier.domesticShippingPaiseStr)
    : 0n;
  const addonsAmountPaise = addons
    .filter((a) => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + BigInt(a.pricePaiseStr), 0n);

  const checkout = calculatePledgeCheckout(
    baseAmountPaise,
    addonsAmountPaise,
    shippingAmountPaise,
    selectedTier?.gstPercentage ?? 18
  );

  const toggleAddon = (id: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Step 1: Create Razorpay Order + Atomic Slot Reservation
  const handleCreateEscrowOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!isPincodeValid) {
      setErrorBanner(
        "Please enter a valid 6-digit Indian PIN code (e.g., 560038)."
      );
      return;
    }
    if (!isPhoneValid) {
      setErrorBanner("Please enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (!isBackerGstinValid) {
      setErrorBanner(
        "Invalid optional B2B GSTIN format. Leave blank for standard B2C invoice."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlugOrId: campaignSlug,
          tierId: selectedTier?.id,
          addonIds: selectedAddonIds,
          shippingAddress: {
            recipientName,
            phone,
            addressLine1,
            landmark,
            city,
            state: pincodeResolution.state || "Karnataka",
            pincode,
            ...(backerGstin.trim() ? { backerGstin: backerGstin.trim() } : {}),
          },
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        pledgeId?: string;
        razorpayOrderId?: string;
        reservationId?: string;
        remainingEarlyBirdSlots?: number | null;
        amountPaiseStr?: string;
      };

      if (!response.ok || !data.success || !data.razorpayOrderId) {
        setErrorBanner(
          data.error ?? "Could not reserve slot or initialize Razorpay order."
        );
        return;
      }

      setOrderState({
        pledgeId: data.pledgeId ?? "",
        razorpayOrderId: data.razorpayOrderId,
        ...(data.reservationId ? { reservationId: data.reservationId } : {}),
        remainingEarlyBirdSlots: data.remainingEarlyBirdSlots,
        totalPaidPaiseStr:
          data.amountPaiseStr ?? checkout.totalPaidPaise.toString(),
        status: "INITIATED",
      });
    } catch {
      setErrorBanner("Network error while creating Razorpay escrow order.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 2: Simulate / Complete Razorpay Standard Checkout + Capture Webhook
  const handleCompleteEscrowCapture = async () => {
    if (!orderState) return;
    setIsSubmitting(true);
    setErrorBanner(null);

    try {
      const response = await fetch("/api/payments/simulate-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          razorpayOrderId: orderState.razorpayOrderId,
          amountPaiseStr: orderState.totalPaidPaiseStr,
          method: paymentMethod,
        }),
      });

      const data = (await response.json()) as {
        success: boolean;
        error?: string;
        razorpayPaymentId?: string;
        ledgerEntry?: {
          debitAccount: string;
          creditAccount: string;
        };
      };

      if (!response.ok || !data.success) {
        setErrorBanner(data.error ?? "Escrow capture verification failed.");
        return;
      }

      setOrderState((prev) =>
        prev
          ? {
              ...prev,
              status: "CAPTURED_IN_ESCROW",
              ...(data.razorpayPaymentId
                ? { razorpayPaymentId: data.razorpayPaymentId }
                : {}),
              ledgerDebitAccount:
                data.ledgerEntry?.debitAccount ?? "GATEWAY_ESCROW_RECEIVABLE",
              ledgerCreditAccount:
                data.ledgerEntry?.creditAccount ?? "CAMPAIGN_ESCROW_LIABILITY",
            }
          : null
      );
    } catch {
      setErrorBanner("Error completing Razorpay escrow capture.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-12 items-start">
      {/* Left 7 Columns: Tier Selection, Add-ons & Indian Shipping Address */}
      <form
        onSubmit={handleCreateEscrowOrder}
        className="space-y-8 lg:col-span-7"
      >
        {errorBanner && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900"
          >
            {errorBanner}
          </div>
        )}

        {/* Section 1: Select Reward Tier with Atomic Early-Bird Slot Counter */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                1. Confirm Pre-Order Reward Tier
              </h2>
              <p className="text-xs text-slate-500">
                Limited Early-Bird tiers use atomic row-level reservation locks
                to prevent overbooking.
              </p>
            </div>
            <TrustBadge variant="emerald">Atomic Slot Guard</TrustBadge>
          </div>

          <div className="space-y-3">
            {tiers.map((tier) => {
              const selected = tier.id === selectedTier?.id;
              const pricePaise = BigInt(tier.pricePaiseStr);
              const remainingSlots =
                tier.earlyBirdLimit !== null
                  ? Math.max(0, tier.earlyBirdLimit - tier.claimedCount)
                  : null;
              const isSoldOut =
                remainingSlots !== null && remainingSlots <= 0;

              return (
                <label
                  key={tier.id}
                  onClick={() => {
                    if (!isSoldOut) setSelectedTierId(tier.id);
                  }}
                  className={`flex flex-col gap-2 rounded-lg border p-4 transition-all ${
                    isSoldOut
                      ? "cursor-not-allowed border-[#E2E8F0] bg-slate-50 opacity-60"
                      : selected
                      ? "cursor-pointer border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                      : "cursor-pointer border-[#E2E8F0] bg-[#FFFFFF] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name="rewardTier"
                        disabled={isSoldOut}
                        checked={selected}
                        onChange={() => setSelectedTierId(tier.id)}
                        className="h-4 w-4 accent-[#0F172A]"
                      />
                      <span className="text-sm font-semibold text-[#0F172A]">
                        {tier.title}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                      {formatPaiseToINR(pricePaise)}
                    </span>
                  </div>

                  <p className="pl-6 text-xs text-slate-600">
                    {tier.description}
                  </p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pl-6 pt-1 text-[11px]">
                    <span className="font-mono text-slate-500">
                      HSN {tier.hsnCode} · Includes {tier.gstPercentage}% GST ·
                      Est. Delivery: {tier.estimatedDeliveryDate}
                    </span>
                    {remainingSlots !== null && (
                      <TrustBadge
                        variant={
                          remainingSlots === 0
                            ? "amber"
                            : remainingSlots <= 15
                            ? "amber"
                            : "emerald"
                        }
                      >
                        {remainingSlots === 0
                          ? "SOLD OUT"
                          : `${remainingSlots} of ${tier.earlyBirdLimit} Early-Bird Slots Left`}
                      </TrustBadge>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Section 2: Optional Add-ons */}
        {addons.length > 0 && (
          <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
            <div className="border-b border-[#E2E8F0] pb-3">
              <h2 className="text-base font-semibold text-[#0F172A]">
                2. Optional Companion Add-ons
              </h2>
              <p className="text-xs text-slate-500">
                Shipped together with your primary reward tier.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {addons.map((addon) => {
                const checked = selectedAddonIds.includes(addon.id);
                const addonPrice = BigInt(addon.pricePaiseStr);
                return (
                  <label
                    key={addon.id}
                    className={`flex items-start justify-between gap-3 rounded-md border p-3.5 text-xs cursor-pointer ${
                      checked
                        ? "border-[#0F172A] bg-[#FAFAFA]"
                        : "border-[#E2E8F0] bg-[#FFFFFF]"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAddon(addon.id)}
                        className="mt-0.5 h-4 w-4 accent-[#0F172A]"
                      />
                      <div>
                        <span className="font-semibold text-[#0F172A] block">
                          {addon.name}
                        </span>
                        <span className="text-slate-500 text-[11px]">
                          {addon.description}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-[#0F172A] shrink-0">
                      +{formatPaiseToINR(addonPrice)}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* Section 3: Indian Shipping Address & PIN Code Validation */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <div>
              <h2 className="text-base font-semibold text-[#0F172A]">
                3. Indian Delivery Address &amp; GST Place-of-Supply
              </h2>
              <p className="text-xs text-slate-500">
                Validated against 6-digit India Post PIN directory for CGST/SGST
                vs IGST tax invoice generation.
              </p>
            </div>
            {isPincodeValid && (
              <TrustBadge variant="emerald">
                {pincodeResolution.state} (State Code{" "}
                {pincodeResolution.gstStateCode})
              </TrustBadge>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Recipient Full Name *
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#0F172A]">
                10-Digit Indian Mobile Number (For Courier OTP) *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/[^0-9]/g, "").slice(0, 10))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 font-mono text-sm text-[#0F172A]"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Flat / House No., Building, Street Address *
              </label>
              <input
                type="text"
                required
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A]"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-[#0F172A]">
                  6-Digit Indian PIN Code *
                </label>
                <span className="font-mono text-[11px] text-slate-500">
                  Regex: ^[1-9][0-9]&#123;5&#125;$
                </span>
              </div>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="560038"
                value={pincode}
                onChange={(e) =>
                  setPincode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
                }
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 font-mono text-sm text-[#0F172A]"
              />
              {pincode.length > 0 && (
                <p
                  className={`text-xs ${
                    isPincodeValid ? "text-[#16A34A]" : "text-red-600"
                  }`}
                >
                  {isPincodeValid
                    ? `✓ Valid PIN (${pincodeResolution.state} · GST Code ${pincodeResolution.gstStateCode})`
                    : "Must be a valid 6-digit Indian PIN code (100000–999999)"}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#0F172A]">
                City / District *
              </label>
              <input
                type="text"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Landmark (Optional)
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 text-sm text-[#0F172A]"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#0F172A]">
                Optional Buyer B2B GSTIN (For Input Tax Credit)
              </label>
              <input
                type="text"
                maxLength={15}
                placeholder="29ABCDE1234F1Z5 (Optional)"
                value={backerGstin}
                onChange={(e) => setBackerGstin(e.target.value.toUpperCase())}
                className="w-full rounded-md border border-[#E2E8F0] bg-[#FFFFFF] px-3 py-2 font-mono text-sm uppercase text-[#0F172A]"
              />
            </div>
          </div>
        </section>

        {/* Section 4: Razorpay Standard Checkout Payment Instrument */}
        <section className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
          <div className="border-b border-[#E2E8F0] pb-3">
            <h2 className="text-base font-semibold text-[#0F172A]">
              4. Razorpay Standard Checkout Instrument
            </h2>
            <p className="text-xs text-slate-500">
              Funds are captured into the regulated nodal escrow account and
              held under All-or-Nothing protection.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                id: "upi" as const,
                title: "UPI Instant Pay",
                subtitle: "GPay, PhonePe, Paytm, BHIM UPI",
              },
              {
                id: "card" as const,
                title: "Credit / Debit Cards",
                subtitle: "RuPay, Visa, Mastercard, Amex",
              },
              {
                id: "netbanking" as const,
                title: "NetBanking (IMPS/NEFT)",
                subtitle: "HDFC, ICICI, SBI, Axis & 50+ Banks",
              },
            ].map((inst) => (
              <button
                key={inst.id}
                type="button"
                onClick={() => setPaymentMethod(inst.id)}
                className={`rounded-md border p-3.5 text-left ${
                  paymentMethod === inst.id
                    ? "border-[#0F172A] bg-[#FAFAFA] ring-1 ring-[#0F172A]"
                    : "border-[#E2E8F0] bg-[#FFFFFF]"
                }`}
              >
                <span className="block text-xs font-semibold text-[#0F172A]">
                  {inst.title}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500">
                  {inst.subtitle}
                </span>
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-[#0F172A] py-3 px-5 text-sm font-semibold text-[#FFFFFF] hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            {isSubmitting
              ? "Reserving Early-Bird Slot & Creating Razorpay Order..."
              : `Reserve Slot & Proceed to Razorpay Escrow (${formatPaiseToINR(
                  checkout.totalPaidPaise
                )})`}
          </button>
        </section>
      </form>

      {/* Right 5 Columns: Sticky GST-Inclusive Summary & Razorpay Escrow Modal */}
      <aside className="sticky top-24 space-y-6 lg:col-span-5">
        <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-4">
          <div className="border-b border-[#E2E8F0] pb-3">
            <span className="font-mono text-[11px] text-slate-500">
              ESCROW CHECKOUT SUMMARY
            </span>
            <h2 className="text-base font-semibold text-[#0F172A]">
              {campaignTitle}
            </h2>
            <p className="text-xs text-slate-500">
              Supplier: {creatorLegalName} (GSTIN: {creatorGstin})
            </p>
          </div>

          <div className="space-y-2.5 text-xs tabular-nums">
            <div className="flex justify-between">
              <span className="text-slate-600">
                Reward Tier ({selectedTier?.title})
              </span>
              <span className="font-mono font-semibold text-[#0F172A]">
                {formatPaiseToINR(checkout.baseAmountPaise)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">
                Optional Add-ons ({selectedAddonIds.length})
              </span>
              <span className="font-mono font-semibold text-[#0F172A]">
                {formatPaiseToINR(checkout.addonsAmountPaise)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600">
                Domestic Insured Shipping ({pincode || "India"})
              </span>
              <span className="font-mono font-semibold text-[#0F172A]">
                {checkout.shippingAmountPaise === 0n
                  ? "FREE"
                  : formatPaiseToINR(checkout.shippingAmountPaise)}
              </span>
            </div>

            <div className="border-t border-[#E2E8F0] pt-2.5 space-y-1 text-[11px] text-slate-500">
              <div className="flex justify-between">
                <span>Net Taxable Value (Pre-GST)</span>
                <span className="font-mono">
                  {formatPaiseToINR(checkout.netPreTaxRewardPaise)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Embedded GST ({selectedTier?.gstPercentage ?? 18}% · HSN{" "}
                  {selectedTier?.hsnCode ?? "9027"})
                </span>
                <span className="font-mono">
                  {formatPaiseToINR(checkout.embeddedRewardGstPaise)}
                </span>
              </div>
            </div>

            <div className="flex justify-between border-t border-[#E2E8F0] pt-3 text-base font-semibold text-[#0F172A]">
              <span>GST-Inclusive Total</span>
              <span className="font-mono text-[#16A34A]">
                {formatPaiseToINR(checkout.totalPaidPaise)}
              </span>
            </div>
            <p className="font-mono text-[11px] text-right text-slate-500">
              Exact Integer Paise: {checkout.totalPaidPaise.toString()} paise
            </p>
          </div>

          <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-3.5 text-xs text-slate-700 leading-relaxed">
            <strong>100% Escrow Protected:</strong> Funds are held in a
            regulated nodal/escrow flow and released to the creator in 3
            verified manufacturing tranches (30% -&gt; 40% -&gt; 30%). Full
            automated refund if the campaign misses its goal.
          </div>
        </div>

        {/* Live Razorpay Order & Webhook Capture Panel */}
        {orderState && (
          <div className="rounded-lg border border-[#0F172A] bg-[#FAFAFA] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-[#0F172A]">
                RAZORPAY STANDARD CHECKOUT
              </span>
              <TrustBadge
                variant={
                  orderState.status === "CAPTURED_IN_ESCROW"
                    ? "emerald"
                    : "slate"
                }
              >
                {orderState.status}
              </TrustBadge>
            </div>

            <div className="space-y-1.5 font-mono text-xs text-slate-700">
              <p>
                <strong>Order ID:</strong> {orderState.razorpayOrderId}
              </p>
              <p>
                <strong>Pledge ID:</strong> {orderState.pledgeId}
              </p>
              {orderState.remainingEarlyBirdSlots !== undefined &&
                orderState.remainingEarlyBirdSlots !== null && (
                  <p className="text-[#16A34A]">
                    <strong>Atomic Slot Reserved:</strong>{" "}
                    {orderState.remainingEarlyBirdSlots} Early-Bird slots
                    remaining
                  </p>
                )}
            </div>

            {orderState.status === "INITIATED" ? (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleCompleteEscrowCapture}
                className="w-full rounded-md bg-[#16A34A] py-2.5 px-4 text-xs font-semibold text-[#FFFFFF] hover:bg-[#15803D]"
              >
                {isSubmitting
                  ? "Verifying HMAC Signature & Writing Ledger Entry..."
                  : `Authorize ${paymentMethod.toUpperCase()} Payment & Trigger payment.captured Webhook`}
              </button>
            ) : (
              <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-2 text-xs">
                <p className="font-semibold text-[#16A34A]">
                  ✓ Payment Captured in Escrow ({orderState.razorpayPaymentId})
                </p>
                <p className="font-mono text-[11px] text-slate-700">
                  DEBIT: {orderState.ledgerDebitAccount}
                  <br />
                  CREDIT: {orderState.ledgerCreditAccount}
                  <br />
                  AMOUNT: {orderState.totalPaidPaiseStr} paise
                </p>
                <div className="pt-2">
                  <Link
                    href="/pledges"
                    className="inline-block rounded bg-[#0F172A] px-3 py-1.5 text-xs font-semibold text-[#FFFFFF]"
                  >
                    View in Backer Escrow Portal →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

