import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  verifyRazorpayWebhookSignature,
  processPaymentCapturedWebhook,
} from "@/lib/services/escrow-payment-service";

/**
 * Helper endpoint for local/sandbox checkout UI to simulate a signed Razorpay
 * `payment.captured` webhook with genuine HMAC-SHA256 verification.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      razorpayOrderId: string;
      amountPaiseStr: string;
      method?: string;
    };

    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ?? "inspirespace_webhook_secret_dev";
    const razorpayPaymentId = `pay_RzpEscrow_${crypto
      .randomUUID()
      .replace(/-/g, "")
      .slice(0, 12)}`;

    const webhookPayload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: razorpayPaymentId,
            order_id: body.razorpayOrderId,
            amount: Number(body.amountPaiseStr),
            currency: "INR",
            status: "captured",
            method: body.method ?? "upi",
          },
        },
      },
    });

    const hmacSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(webhookPayload)
      .digest("hex");

    const verified = verifyRazorpayWebhookSignature(
      webhookPayload,
      hmacSignature,
      webhookSecret
    );
    if (!verified) {
      return NextResponse.json(
        { success: false, error: "HMAC signature self-check failed." },
        { status: 401 }
      );
    }

    const result = await processPaymentCapturedWebhook({
      razorpayOrderId: body.razorpayOrderId,
      razorpayPaymentId,
      amountCapturedPaise: BigInt(body.amountPaiseStr),
      paymentMethod: body.method ?? "upi",
    });

    return NextResponse.json({
      ...result,
      razorpayPaymentId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Simulation capture failed.",
      },
      { status: 500 }
    );
  }
}

