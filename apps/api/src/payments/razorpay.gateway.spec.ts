import { createHmac } from "node:crypto";
import { RazorpayGateway } from "./razorpay.gateway";

describe("RazorpayGateway signatures", () => {
  const g = new RazorpayGateway();
  const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex");

  it("accepts a genuine checkout signature and rejects a forged one", () => {
    expect(g.verifyCheckout("order_1", "pay_1", sign("order_1|pay_1", "s3cret"), "s3cret")).toBe(true);
    expect(g.verifyCheckout("order_1", "pay_2", sign("order_1|pay_1", "s3cret"), "s3cret")).toBe(false);
    expect(g.verifyCheckout("order_1", "pay_1", sign("order_1|pay_1", "other"), "s3cret")).toBe(false);
    expect(g.verifyCheckout("order_1", "pay_1", "short", "s3cret")).toBe(false);
  });

  it("verifies webhook bodies", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    expect(g.verifyWebhook(body, sign(body, "whsec"), "whsec")).toBe(true);
    expect(g.verifyWebhook(body + " ", sign(body, "whsec"), "whsec")).toBe(false);
  });
});
