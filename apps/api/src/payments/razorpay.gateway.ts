import { BadGatewayException, Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
}

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Talks to Razorpay. Kept as one small class so tests can replace the network call. */
@Injectable()
export class RazorpayGateway {
  async createOrder(keyId: string, keySecret: string, order: { amountMinor: number; currency: string; receipt: string; notes?: Record<string, string> }): Promise<RazorpayOrder> {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}` },
      body: JSON.stringify({ amount: order.amountMinor, currency: order.currency, receipt: order.receipt, notes: order.notes }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; amount?: number; currency?: string; error?: { description?: string } };
    if (!res.ok || !body.id) throw new BadGatewayException(`Razorpay refused the order: ${body.error?.description ?? res.statusText}`);
    return { id: body.id, amount: body.amount ?? order.amountMinor, currency: body.currency ?? order.currency };
  }

  /** Checks the signature Razorpay Checkout returns to the browser: HMAC-SHA256 of "order_id|payment_id". */
  verifyCheckout(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
    return safeEqual(createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex"), signature);
  }

  /** Checks a webhook: HMAC-SHA256 of the raw request body with the webhook secret. */
  verifyWebhook(rawBody: Buffer | string, signature: string, webhookSecret: string): boolean {
    return safeEqual(createHmac("sha256", webhookSecret).update(rawBody).digest("hex"), signature);
  }
}
