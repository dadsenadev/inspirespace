import { NextResponse } from "next/server";
import {
  verifyRazorpayWebhookSignature,
  processPaymentCapturedWebhook,
} from "@/lib/services/escrow-payment-service";

interface RazorpayWebhookPayload {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id?: string;
        order_id?: string;
        amount?: number;
        currency?: string;
        status?: string;
        method?: string;
      };
    };
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signatureHeader =
      request.headers.get("x-razorpay-signature") ?? "";
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ?? "inspirespace_webhook_secret_dev";

    // 1. Verify HMAC SHA256 Signature
    const isSignatureValid = verifyRazorpayWebhookSignature(
      rawBody,
      signatureHeader,
      webhookSecret
    );

    if (!isSignatureValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_WEBHOOK_SIGNATURE: HMAC-SHA256 verification failed for x-razorpay-signature.",
        },
        { status: 401 }
      );
    }

    const parsed = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const eventType = parsed.event ?? "";

    // 2. Process `payment.captured` event
    if (eventType === "payment.captured") {
      const paymentEntity = parsed.payload?.payment?.entity;
      const razorpayPaymentId = paymentEntity?.id;
      const razorpayOrderId = paymentEntity?.order_id;
      const amountPaiseNum = paymentEntity?.amount;

      if (
        !razorpayPaymentId ||
        !razorpayOrderId ||
        typeof amountPaiseNum !== "number"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "MALFORMED_PAYMENT_ENTITY: Missing id, order_id, or integer paise amount.",
          },
          { status: 400 }
        );
      }

      const captureResult = await processPaymentCapturedWebhook({
        razorpayOrderId,
        razorpayPaymentId,
        amountCapturedPaise: BigInt(Math.round(amountPaiseNum)),
        ...(paymentEntity?.method
          ? { paymentMethod: paymentEntity.method }
          : {}),
      });

      if (!captureResult.success) {
        return NextResponse.json(captureResult, { status: 422 });
      }

      return NextResponse.json({
        success: true,
        event: eventType,
        ...captureResult,
      });
    }

    return NextResponse.json({
      success: true,
      ignoredEvent: eventType,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Webhook processing failure.",
      },
      { status: 500 }
    );
  }
}

