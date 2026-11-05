"use client";

import * as React from "react";
import Link from "next/link";
import { TrustBadge } from "@/components/ui/trust-badge";
import {
  calculatePledgeCheckout,
  formatPaiseToINR,
} from "@/lib/finance/calculator";

export interface SerializableRewardTier {
  id: string;
  title: string;
  description: string;
  pricePaiseStr: string;
  hsnCode: string;
  gstPercentage: number;
  earlyBirdLimit: number | null;
  claimedCount: number;
  itemizedInclusions: string[];
  estimatedDeliveryDate: string;
  shippingScope: "INDIA_ONLY" | "GLOBAL";
  domesticShippingPaiseStr: string;
}

export interface SerializableAddon {
  id: string;
  name: string;
  description: string;
  pricePaiseStr: string;
  stockLimit: number | null;
  claimedCount: number;
}

export interface ProjectTierSelectorProps {
  campaignSlug: string;
  campaignTitle: string;
  pledgedFormatted: string;
  goalFormatted: string;
  percentFunded: number;
  backerCount: number;
  daysLeft: number;
  tiers: SerializableRewardTier[];
  addons: SerializableAddon[];
}

export function ProjectTierSelector({
  campaignSlug,
  campaignTitle,
  pledgedFormatted,
  goalFormatted,
  percentFunded,
  backerCount,
  daysLeft,
  tiers,
  addons,
}: ProjectTierSelectorProps) {
  const [selectedTierId, setSelectedTierId] = React.useState<string>(
    tiers[0]?.id ?? ""
  );
  const [selectedAddonIds, setSelectedAddonIds] = React.useState<string[]>([]);
  const [pledgeSuccessModal, setPledgeSuccessModal] =
    React.useState<boolean>(false);

  const selectedTier =
    tiers.find((t) => t.id === selectedTierId) ?? tiers[0];

  const toggleAddon = (addonId: string) => {
    setSelectedAddonIds((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  };

  const baseAmountPaise = selectedTier
    ? BigInt(selectedTier.pricePaiseStr)
    : 100n;
  const shippingAmountPaise = selectedTier
    ? BigInt(selectedTier.domesticShippingPaiseStr)
    : 0n;
  const addonsAmountPaise = addons
    .filter((a) => selectedAddonIds.includes(a.id))
    .reduce((sum, a) => sum + BigInt(a.pricePaiseStr), 0n);

  const checkoutSummary = calculatePledgeCheckout(
    baseAmountPaise,
    addonsAmountPaise,
    shippingAmountPaise,
    selectedTier?.gstPercentage ?? 18
  );

  const clampedBarWidth = Math.min(100, Math.max(0, percentFunded));

  return (
    <aside className="sticky top-24 space-y-5">
      {/* Live Funding Progress & Primary CTA Card */}
      <div className="rounded-lg border border-[#E2E8F0] bg-[#FFFFFF] p-6 space-y-5 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tracking-tight text-[#0F172A] tabular-nums">
              {pledgedFormatted}
            </span>
            <span className="font-mono text-xs font-semibold text-[#16A34A] tabular-nums">
              {percentFunded}% of {goalFormatted} goal
            </span>
          </div>

          {/* Live Progress Bar */}
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 border border-[#E2E8F0]"
            role="progressbar"
            aria-valuenow={percentFunded}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-[#16A34A] transition-all duration-300"
              style={{ width: `${clampedBarWidth}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-[#E2E8F0] tabular-nums">
            <div className="rounded bg-[#FAFAFA] p-2">
              <span className="block text-base font-semibold text-[#0F172A]">
                {percentFunded}%
              </span>
              <span className="text-[11px] text-slate-500">Funded</span>
            </div>
            <div className="rounded bg-[#FAFAFA] p-2">
              <span className="block text-base font-semibold text-[#0F172A]">
                {backerCount.toLocaleString("en-IN")}
              </span>
              <span className="text-[11px] text-slate-500">Backers</span>
            </div>
            <div className="rounded bg-[#FAFAFA] p-2">
              <span className="block text-base font-semibold text-[#0F172A]">
                {daysLeft}
              </span>
              <span className="text-[11px] text-slate-500">Days Left</span>
            </div>
          </div>
        </div>

        {/* Selected Pledge Breakdown */}
        {selectedTier && (
          <div className="rounded-md border border-[#E2E8F0] bg-[#FAFAFA] p-3.5 space-y-1.5 text-xs tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span>Selected Tier ({selectedTier.title.slice(0, 26)}...)</span>
              <span className="font-mono font-medium text-[#0F172A]">
                {formatPaiseToINR(checkoutSummary.baseAmountPaise)}
              </span>
            </div>
            {checkoutSummary.addonsAmountPaise > 0n && (
              <div className="flex justify-between text-slate-600">
                <span>Add-ons ({selectedAddonIds.length} selected)</span>
                <span className="font-mono font-medium text-[#0F172A]">
                  +{formatPaiseToINR(checkoutSummary.addonsAmountPaise)}
                </span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Domestic Insured Shipping</span>
              <span className="font-mono font-medium text-[#0F172A]">
                {checkoutSummary.shippingAmountPaise === 0n
                  ? "FREE"
                  : `+${formatPaiseToINR(checkoutSummary.shippingAmountPaise)}`}
              </span>
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-[#E2E8F0]">
              <span>
                Includes GST ({selectedTier.gstPercentage}% · HSN{" "}
                {selectedTier.hsnCode})
              </span>
              <span className="font-mono">
                {formatPaiseToINR(checkoutSummary.embeddedRewardGstPaise)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold text-[#0F172A] pt-1">
              <span>Total Escrow Pledge</span>
              <span className="font-mono text-[#16A34A]">
                {formatPaiseToINR(checkoutSummary.totalPaidPaise)}
              </span>
            </div>
          </div>
        )}

        {/* Primary "Back This Project" CTA Button */}
        <Link
          href={`/projects/${campaignSlug}/pledge?tier=${encodeURIComponent(
            selectedTier?.id ?? ""
          )}${
            selectedAddonIds.length > 0
              ? `&addons=${encodeURIComponent(selectedAddonIds.join(","))}`
              : ""
          }`}
          className="block w-full rounded-md bg-[#16A34A] py-3 px-4 text-center text-sm font-semibold text-[#FFFFFF] shadow-sm hover:bg-[#15803D] transition-colors"
        >
          Back This Project — {formatPaiseToINR(checkoutSummary.totalPaidPaise)}
        </Link>

        {/* Dedicated Trust & Escrow Protection Callout Card right below Back This Project button */}
        <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-4 space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#16A34A] text-[11px] font-bold text-[#FFFFFF]"
              aria-hidden="true"
            >
              ✓
            </span>
            <h3 className="text-xs font-semibold text-[#0F172A]">
              Trust &amp; Escrow Protection
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-slate-700">
            <strong>100% Escrow Protected:</strong> Funds are held in a
            regulated nodal/escrow flow and released to the creator in 3
            verified manufacturing tranches (30% -&gt; 40% -&gt; 30%). Full
            automated refund if the campaign misses its goal.
          </p>
        </div>

        {pledgeSuccessModal && (
          <div className="rounded-md border border-[#0F172A] bg-[#FAFAFA] p-3.5 text-xs space-y-1">
            <p className="font-semibold text-[#0F172A]">
              ✓ Escrow Order Initialized for {campaignTitle}
            </p>
            <p className="font-mono text-[11px] text-slate-600">
              Locked Amount: {checkoutSummary.totalPaidPaise.toString()} paise (
              {formatPaiseToINR(checkoutSummary.totalPaidPaise)}) · Status:
              INITIATED
            </p>
          </div>
        )}
      </div>

      {/* Sticky Reward Tier Selector List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
            Select Pre-Order Reward Tier
          </h2>
          <span className="font-mono text-[11px] text-slate-500">
            GST Invoice Included
          </span>
        </div>

        {tiers.map((tier) => {
          const isSelected = tier.id === selectedTier?.id;
          const pricePaise = BigInt(tier.pricePaiseStr);
          const remainingSlots =
            tier.earlyBirdLimit !== null
              ? Math.max(0, tier.earlyBirdLimit - tier.claimedCount)
              : null;

          return (
            <div
              key={tier.id}
              onClick={() => setSelectedTierId(tier.id)}
              className={`cursor-pointer rounded-lg border p-4 transition-all space-y-3 ${
                isSelected
                  ? "border-[#0F172A] bg-[#FFFFFF] ring-1 ring-[#0F172A]"
                  : "border-[#E2E8F0] bg-[#FAFAFA] hover:bg-[#FFFFFF]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-[#0F172A]">
                    {tier.title}
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500">
                    HSN {tier.hsnCode} · Includes {tier.gstPercentage}% GST
                  </span>
                </div>
                <span className="font-mono text-sm font-semibold text-[#0F172A] tabular-nums">
                  {formatPaiseToINR(pricePaise, {
                    includePaiseDecimals: false,
                  })}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                {tier.description}
              </p>

              {/* Itemized Inclusions */}
              <ul className="space-y-1 border-t border-[#E2E8F0] pt-2.5 text-xs text-slate-700">
                {tier.itemizedInclusions.map((item, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="text-[#16A34A] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8F0] pt-2.5 text-[11px]">
                <span className="font-mono text-slate-500">
                  Est. Delivery: {tier.estimatedDeliveryDate}
                </span>
                {remainingSlots !== null && (
                  <TrustBadge
                    variant={remainingSlots <= 15 ? "amber" : "emerald"}
                  >
                    {remainingSlots} of {tier.earlyBirdLimit} Left
                  </TrustBadge>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Add-ons Selector */}
      {addons.length > 0 && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#FAFAFA] p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#0F172A]">
            Optional Checkout Add-ons
          </h3>
          <div className="space-y-2">
            {addons.map((addon) => {
              const checked = selectedAddonIds.includes(addon.id);
              const addonPrice = BigInt(addon.pricePaiseStr);
              return (
                <label
                  key={addon.id}
                  className="flex items-start justify-between gap-3 rounded border border-[#E2E8F0] bg-[#FFFFFF] p-3 text-xs cursor-pointer"
                >
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAddon(addon.id)}
                      className="mt-0.5 h-4 w-4 rounded border-[#E2E8F0]"
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
                    +
                    {formatPaiseToINR(addonPrice, {
                      includePaiseDecimals: false,
                    })}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}

