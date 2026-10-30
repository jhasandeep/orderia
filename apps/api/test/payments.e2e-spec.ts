import { INestApplication } from "@nestjs/common";
import { auth, createApp, FakeRazorpay, hmac, http, nextWeekday, signUp } from "./helpers";

describe("payments", () => {
  let app: INestApplication;
  let razorpay: FakeRazorpay;
  let owner: Awaited<ReturnType<typeof signUp>>;
  let biz: { id: string; slug: string };
  let service: { id: string };
  let provider: { id: string };
  const monday = nextWeekday(1);
  const phone = "9822211100";
  let slotIndex = 0;
  const times = Array.from({ length: 20 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

  const newBooking = async () => {
    const time = times[slotIndex++];
    const res = await http(app).post(`/api/v1/public/businesses/${biz.slug}/bookings`).send({ serviceId: service.id, providerId: provider.id, date: monday, time, guestName: "Payer", guestPhone: phone }).expect(201);
    return res.body as { id: string; code: string };
  };
  const bookingStatus = async (code: string) => (await http(app).get(`/api/v1/public/bookings/${code}?phone=${phone}`).expect(200)).body as { status: string; paymentStatus: string; paidMinor: number };
  const settings = (body: object) => http(app).put(`/api/v1/businesses/${biz.id}/payment-settings`).set(auth(owner.token)).send(body);

  beforeAll(async () => {
    ({ app, razorpay } = await createApp());
    owner = await signUp(app, "Merchant");
    biz = (await http(app).post("/api/v1/businesses").set(auth(owner.token)).send({ name: "Pay Clinic", type: "DOCTOR" }).expect(201)).body;
    service = (await http(app).post(`/api/v1/businesses/${biz.id}/services`).set(auth(owner.token)).send({ name: "Consultation", durationMinutes: 30, priceMinor: 100000 }).expect(201)).body;
    provider = (await http(app).post(`/api/v1/businesses/${biz.id}/providers`).set(auth(owner.token)).send({ name: "Dr Rao", serviceIds: [service.id] }).expect(201)).body;
    await http(app).put(`/api/v1/businesses/${biz.id}/providers/${provider.id}/availability`).set(auth(owner.token)).send({ rules: [{ weekday: 1, startTime: "09:00", endTime: "20:00" }] }).expect(200);
  });
  afterAll(() => app.close());

  it("starts with cash only", async () => {
    const s = await http(app).get(`/api/v1/businesses/${biz.id}/payment-settings`).set(auth(owner.token)).expect(200);
    expect(s.body.enabledMethods).toEqual(["CASH"]);
    const b = await newBooking();
    await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "UPI_QR", phone }).expect(400); // not switched on yet
    await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "CASH", phone: "1234567890" }).expect(404); // wrong phone
  });

  it("validates payment settings and never returns secrets", async () => {
    await settings({ enabledMethods: ["UPI_QR"] }).expect(400); // needs a UPI id
    await settings({ enabledMethods: ["RAZORPAY"] }).expect(400); // needs keys
    await settings({ upiId: "not a upi id" }).expect(400);
    const ok = await settings({ enabledMethods: ["CASH", "UPI_QR", "RAZORPAY"], upiId: "clinic@okbank", upiName: "Pay Clinic", razorpayKeyId: "rzp_test_abc", razorpayKeySecret: "super-secret-value", razorpayWebhookSecret: "whsec_123" }).expect(200);
    expect(ok.body.razorpay).toEqual({ keyId: "rzp_test_abc", secretSet: true, webhookSecretSet: true });
    expect(JSON.stringify(ok.body)).not.toContain("super-secret-value");
    expect(JSON.stringify((await http(app).get(`/api/v1/public/businesses/${biz.slug}`)).body)).not.toContain("super-secret-value");
    // only the owner may change them
    const mgr = await signUp(app, "Manager");
    await http(app).post(`/api/v1/businesses/${biz.id}/team`).set(auth(owner.token)).send({ name: "Manager", email: mgr.email, role: "MANAGER" }).expect(201);
    await http(app).put(`/api/v1/businesses/${biz.id}/payment-settings`).set(auth(mgr.token)).send({ advancePercent: 10 }).expect(403);
    await http(app).get(`/api/v1/businesses/${biz.id}/payment-settings`).set(auth(mgr.token)).expect(200);
  });

  it("takes a direct UPI QR payment that staff verify", async () => {
    const b = await newBooking();
    const start = await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "UPI_QR", phone }).expect(201);
    expect(start.body.payment).toMatchObject({ method: "UPI_QR", status: "CREATED", amountMinor: 100000 });
    expect(start.body.upi.link).toMatch(/^upi:\/\/pay\?/);
    const link = new URL(start.body.upi.link.replace("upi://", "https://x/"));
    expect(link.searchParams.get("pa")).toBe("clinic@okbank");
    expect(link.searchParams.get("am")).toBe("1000.00");
    expect(link.searchParams.get("cu")).toBe("INR");
    expect(link.searchParams.get("tr")).toBe(b.code);
    expect(start.body.upi.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const id = start.body.payment.id;

    await http(app).post(`/api/v1/public/payments/${id}/upi-reference`).send({ reference: "12" }).expect(400);
    const sent = await http(app).post(`/api/v1/public/payments/${id}/upi-reference`).send({ reference: "utr1234567890" }).expect(201);
    expect(sent.body).toMatchObject({ status: "PENDING_VERIFICATION", reference: "UTR1234567890" });
    expect((await bookingStatus(b.code)).paymentStatus).toBe("UNPAID"); // not paid until staff check

    const waiting = await http(app).get(`/api/v1/businesses/${biz.id}/payments?status=PENDING_VERIFICATION`).set(auth(owner.token)).expect(200);
    expect(waiting.body.map((p: { id: string }) => p.id)).toContain(id);
    expect((await http(app).get(`/api/v1/businesses/${biz.id}/stats`).set(auth(owner.token))).body.paymentsToVerify).toBe(1);

    await http(app).post(`/api/v1/businesses/${biz.id}/payments/${id}/confirm`).set(auth(owner.token)).expect(201);
    expect(await bookingStatus(b.code)).toMatchObject({ paymentStatus: "PAID", paidMinor: 100000 });
    await http(app).post(`/api/v1/businesses/${biz.id}/payments/${id}/confirm`).set(auth(owner.token)).expect(201); // safe to repeat
    expect((await bookingStatus(b.code)).paidMinor).toBe(100000); // not counted twice
    await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "UPI_QR", phone }).expect(409); // nothing left to pay
  });

  it("lets staff reject a payment that does not match", async () => {
    const b = await newBooking();
    const start = await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "UPI_QR", phone }).expect(201);
    await http(app).post(`/api/v1/public/payments/${start.body.payment.id}/upi-reference`).send({ reference: "FAKEUTR12345" }).expect(201);
    const rej = await http(app).post(`/api/v1/businesses/${biz.id}/payments/${start.body.payment.id}/reject`).set(auth(owner.token)).expect(201);
    expect(rej.body.status).toBe("REJECTED");
    expect((await bookingStatus(b.code)).paymentStatus).toBe("UNPAID");
  });

  it("asks for an advance first, then the balance", async () => {
    await settings({ advancePercent: 30 }).expect(200);
    const b = await newBooking();
    const first = await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "CASH", phone }).expect(201);
    expect(first.body.payment.amountMinor).toBe(30000);
    await http(app).post(`/api/v1/businesses/${biz.id}/payments/${first.body.payment.id}/confirm`).set(auth(owner.token)).expect(201);
    expect(await bookingStatus(b.code)).toMatchObject({ paymentStatus: "PARTIAL", paidMinor: 30000 });
    const rest = await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "CASH", phone }).expect(201);
    expect(rest.body.payment.amountMinor).toBe(70000); // the balance, not another 30%
    await http(app).post(`/api/v1/businesses/${biz.id}/payments/${rest.body.payment.id}/confirm`).set(auth(owner.token)).expect(201);
    expect((await bookingStatus(b.code)).paymentStatus).toBe("PAID");
    await settings({ advancePercent: 0 }).expect(200);
  });

  it("confirms a pending booking once it is paid", async () => {
    await http(app).patch(`/api/v1/businesses/${biz.id}`).set(auth(owner.token)).send({ autoConfirm: false }).expect(200);
    const b = await newBooking();
    expect((await bookingStatus(b.code)).status).toBe("PENDING");
    const rec = await http(app).post(`/api/v1/businesses/${biz.id}/payments`).set(auth(owner.token)).send({ bookingId: b.id, method: "CASH" }).expect(201);
    expect(rec.body.status).toBe("PAID");
    expect(await bookingStatus(b.code)).toMatchObject({ status: "CONFIRMED", paymentStatus: "PAID" });
    await http(app).post(`/api/v1/businesses/${biz.id}/payments`).set(auth(owner.token)).send({ bookingId: b.id, method: "CASH" }).expect(409); // nothing due
    await http(app).post(`/api/v1/businesses/${biz.id}/payments`).set(auth(owner.token)).send({ method: "CASH" }).expect(400);
    await http(app).patch(`/api/v1/businesses/${biz.id}`).set(auth(owner.token)).send({ autoConfirm: true }).expect(200);
  });

  describe("Razorpay", () => {
    const pay = async () => {
      const b = await newBooking();
      const start = await http(app).post(`/api/v1/public/bookings/${b.code}/payments`).send({ method: "RAZORPAY", phone }).expect(201);
      return { b, orderId: start.body.razorpay.orderId as string, paymentId: start.body.payment.id as string, start };
    };

    it("creates an order with the business's own keys", async () => {
      const { start } = await pay();
      expect(start.body.razorpay).toMatchObject({ keyId: "rzp_test_abc", amountMinor: 100000, currency: "INR", name: "Pay Clinic" });
      expect(razorpay.created.at(-1)).toMatchObject({ keyId: "rzp_test_abc", amountMinor: 100000 });
    });

    it("marks it paid when the browser returns a genuine signature", async () => {
      const { b, orderId } = await pay();
      const sig = hmac(`${orderId}|pay_abc123`, "super-secret-value");
      const ok = await http(app).post("/api/v1/public/payments/razorpay/verify").send({ razorpay_order_id: orderId, razorpay_payment_id: "pay_abc123", razorpay_signature: sig }).expect(201);
      expect(ok.body.status).toBe("PAID");
      expect(await bookingStatus(b.code)).toMatchObject({ paymentStatus: "PAID", paidMinor: 100000 });
      await http(app).post("/api/v1/public/payments/razorpay/verify").send({ razorpay_order_id: orderId, razorpay_payment_id: "pay_abc123", razorpay_signature: sig }).expect(201); // repeat is harmless
    });

    it("rejects a forged signature and marks the payment failed", async () => {
      const { b, orderId, paymentId } = await pay();
      await http(app).post("/api/v1/public/payments/razorpay/verify").send({ razorpay_order_id: orderId, razorpay_payment_id: "pay_x", razorpay_signature: hmac(`${orderId}|pay_x`, "wrong-secret") }).expect(400);
      expect((await bookingStatus(b.code)).paymentStatus).toBe("UNPAID");
      const list = await http(app).get(`/api/v1/businesses/${biz.id}/payments?status=FAILED`).set(auth(owner.token));
      expect(list.body.map((p: { id: string }) => p.id)).toContain(paymentId);
      await http(app).post(`/api/v1/public/payments/razorpay/verify`).send({ razorpay_order_id: "order_unknown", razorpay_payment_id: "p", razorpay_signature: "s" }).expect(404);
    });

    it("accepts a signed webhook even if the customer closed the page", async () => {
      const { b, orderId } = await pay();
      const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_hook1", order_id: orderId } } } });
      await http(app).post(`/api/v1/public/webhooks/razorpay/${biz.id}`).set("content-type", "application/json").set("x-razorpay-signature", "bad").send(body).expect(403);
      expect((await bookingStatus(b.code)).paymentStatus).toBe("UNPAID");
      await http(app).post(`/api/v1/public/webhooks/razorpay/${biz.id}`).set("content-type", "application/json").set("x-razorpay-signature", hmac(body, "whsec_123")).send(body).expect(201);
      expect(await bookingStatus(b.code)).toMatchObject({ paymentStatus: "PAID", paidMinor: 100000 });
    });

    it("does not let staff confirm Razorpay payments by hand", async () => {
      const { paymentId } = await pay();
      await http(app).post(`/api/v1/businesses/${biz.id}/payments/${paymentId}/confirm`).set(auth(owner.token)).expect(400);
    });
  });
});
