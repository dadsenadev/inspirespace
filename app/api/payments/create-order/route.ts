import { NextResponse } from "next/server";
import {
  createRazorpayEscrowOrder,
  resolveStateFromPincode,
} from "@/lib/services/escrow-payment-service";
import type { ShippingAddressJson } from "@/lib/db/schema";

export interface CreateOrderRequestBody {
  campaignSlugOrId: string;
  tierId: string;
  addonIds?: string[];
  backerId?: string;
  backerEmail?: string;
  shippingAddress: {
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    landmark?: string;
    city: string;
    state?: string;
    pincode: string;
    backerGstin?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateOrderRequestBody;

    if (!body.campaignSlugOrId || !body.tierId || !body.shippingAddress) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Missing required checkout fields (campaignSlugOrId, tierId, shippingAddress).",
        },
        { status: 400 }
      );
    }

    const pincodeResolution = resolveStateFromPincode(
      body.shippingAddress.pincode?.trim() ?? ""
    );

    const normalizedAddress: ShippingAddressJson = {
      recipientName: body.shippingAddress.recipientName?.trim() ?? "",
      phone: body.shippingAddress.phone?.trim() ?? "",
      addressLine1: body.shippingAddress.addressLine1?.trim() ?? "",
      ...(body.shippingAddress.addressLine2
        ? { addressLine2: body.shippingAddress.addressLine2.trim() }
        : {}),
      ...(body.shippingAddress.landmark
        ? { landmark: body.shippingAddress.landmark.trim() }
        : {}),
      city: body.shippingAddress.city?.trim() ?? "",
      state:
        body.shippingAddress.state?.trim() ||
        pincodeResolution.state ||
        "Karnataka",
      stateCode: pincodeResolution.gstStateCode || "29",
      pincode: body.shippingAddress.pincode?.trim() ?? "",
      country: "India",
      ...(body.shippingAddress.backerGstin
        ? { backerGstin: body.shippingAddress.backerGstin.trim().toUpperCase() }
        : {}),
    };

    const result = await createRazorpayEscrowOrder({
      campaignSlugOrId: body.campaignSlugOrId,
      tierId: body.tierId,
      addonIds: body.addonIds ?? [],
      backerId:
        body.backerId ?? "00000000-0000-4000-8000-000000000202",
      backerEmail: body.backerEmail ?? "backer@inspirespace.in",
      ShippingAddress: normalizedAddress,
    });

    if (!result.success) {
      const status = result.error?.startsWith("EARLY_BIRD_SOLD_OUT")
        ? 409
        : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Internal error creating Razorpay escrow order.",
      },
      { status: 500 }
    );
  }
}

