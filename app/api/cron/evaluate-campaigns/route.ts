import { NextResponse } from "next/server";
import {
  evaluateExpiredCampaigns,
  type ExpiredCampaignEvaluationCandidate,
} from "@/lib/services/escrow-payment-service";

/**
 * Cron / Edge endpoint (`/app/api/cron/evaluate-campaigns`)
 * Evaluates all `LIVE` campaigns past `end_date`:
 * 1. `pledged_amount_paise >= goal_amount_paise` -> `SUCCESSFUL`, unlocks `TRANCHE_1_30_PCT`.
 * 2. `pledged_amount_paise < goal_amount_paise` -> `FAILED_REFUNDING`, triggers Razorpay batch
 *    refunds (`POST /v1/payments/{id}/refund`), writes double-entry reversals to `ledger_entries`,
 *    and marks pledges as `REFUNDED`.
 */
export async function POST(request: Request) {
  try {
    // Optional CRON_SECRET bearer check when configured in production
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: "UNAUTHORIZED_CRON_INVOCATION" },
          { status: 401 }
        );
      }
    }

    let customCandidates: ExpiredCampaignEvaluationCandidate[] | undefined;
    try {
      const body = (await request.json()) as {
        candidates?: Array<{
          campaignId: string;
          title: string;
          endDateIso: string;
          goalAmountPaiseStr: string;
          pledgedAmountPaiseStr: string;
          status:
            | "DRAFT"
            | "UNDER_REVIEW"
            | "LIVE"
            | "SUCCESSFUL"
            | "FAILED_REFUNDING"
            | "COMPLETED";
          capturedPledges: Array<{
            pledgeId: string;
            backerId: string;
            totalPaidPaiseStr: string;
            razorpayPaymentId: string;
          }>;
        }>;
      };

      if (Array.isArray(body?.candidates)) {
        customCandidates = body.candidates.map((c) => ({
          campaignId: c.campaignId,
          title: c.title,
          endDateIso: c.endDateIso,
          goalAmountPaise: BigInt(c.goalAmountPaiseStr),
          pledgedAmountPaise: BigInt(c.pledgedAmountPaiseStr),
          status: c.status,
          capturedPledges: c.capturedPledges.map((p) => ({
            pledgeId: p.pledgeId,
            backerId: p.backerId,
            totalPaidPaise: BigInt(p.totalPaidPaiseStr),
            razorpayPaymentId: p.razorpayPaymentId,
          })),
        }));
      }
    } catch {
      // No JSON body provided; will evaluate database campaigns
    }

    const evaluation = await evaluateExpiredCampaigns(
      customCandidates ? { candidatesOverride: customCandidates } : undefined
    );

    return NextResponse.json({
      success: true,
      ...evaluation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Campaign evaluation cron failed.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}

