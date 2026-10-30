import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as QRCode from "qrcode";
import { Repository } from "typeorm";
import { decrypt, encrypt } from "../common/crypto";
import { PAYMENT_METHODS, type PaymentMethod } from "../common/enums";
import { samePhone } from "../common/phone";
import { Booking, Business, DiningOrder, Payment, PaymentSettings } from "../entities";
import { RecordPaymentDto, StartPaymentDto, UpdatePaymentSettingsDto } from "./payments.dto";
import { RazorpayGateway } from "./razorpay.gateway";

interface Payable {
  kind: "booking" | "order";
  id: string;
  businessId: string;
  code: string;
  totalMinor: number;
  paidMinor: number;
  label: string;
  /** Bookings may ask for an advance; orders are paid in full. */
  allowAdvance: boolean;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment) private payments: Repository<Payment>,
    @InjectRepository(PaymentSettings) private settingsRepo: Repository<PaymentSettings>,
    @InjectRepository(Business) private businesses: Repository<Business>,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(DiningOrder) private orders: Repository<DiningOrder>,
    private razorpay: RazorpayGateway,
  ) {}

  // ---- settings
  async getSettings(businessId: string) {
    const s = (await this.settingsRepo.findOne({ where: { businessId } })) ?? (await this.settingsRepo.save(this.settingsRepo.create({ businessId, enabledMethods: ["CASH"], advancePercent: 0 })));
    return this.settingsView(s);
  }

  private settingsView(s: PaymentSettings) {
    return {
      enabledMethods: s.enabledMethods,
      advancePercent: s.advancePercent,
      upiId: s.upiId,
      upiName: s.upiName,
      // the secret is never sent back, only whether it is set
      razorpay: { keyId: s.razorpayKeyId, secretSet: Boolean(s.razorpayKeySecretEnc), webhookSecretSet: Boolean(s.razorpayWebhookSecretEnc) },
    };
  }

  async updateSettings(businessId: string, dto: UpdatePaymentSettingsDto) {
    const s = (await this.settingsRepo.findOne({ where: { businessId } })) ?? this.settingsRepo.create({ businessId, enabledMethods: ["CASH"], advancePercent: 0 });
    if (dto.enabledMethods) s.enabledMethods = [...new Set(dto.enabledMethods)];
    if (dto.upiId !== undefined) s.upiId = dto.upiId || null;
    if (dto.upiName !== undefined) s.upiName = dto.upiName || null;
    if (dto.advancePercent !== undefined) s.advancePercent = dto.advancePercent;
    if (dto.razorpayKeyId !== undefined) s.razorpayKeyId = dto.razorpayKeyId || null;
    if (dto.razorpayKeySecret) s.razorpayKeySecretEnc = encrypt(dto.razorpayKeySecret);
    if (dto.razorpayWebhookSecret) s.razorpayWebhookSecretEnc = encrypt(dto.razorpayWebhookSecret);
    if (s.enabledMethods.includes("UPI_QR") && !s.upiId) throw new BadRequestException("Add your UPI id to accept UPI QR payments.");
    if (s.enabledMethods.includes("RAZORPAY") && (!s.razorpayKeyId || !s.razorpayKeySecretEnc)) throw new BadRequestException("Add your Razorpay key id and key secret to accept Razorpay payments.");
    return this.settingsView(await this.settingsRepo.save(s));
  }

  // ---- starting a payment
  private async payableBooking(code: string, phone: string): Promise<Payable> {
    const b = await this.bookings.findOne({ where: { code: code.trim().toUpperCase() }, relations: { service: true } });
    if (!b || !samePhone(b.guestPhone, phone ?? "")) throw new NotFoundException("No booking found with that code and phone number.");
    if (b.status === "CANCELLED") throw new BadRequestException("This booking was cancelled.");
    return { kind: "booking", id: b.id, businessId: b.businessId, code: b.code, totalMinor: b.totalMinor, paidMinor: b.paidMinor, label: `${b.service.name} (${b.code})`, allowAdvance: true };
  }

  private async payableOrder(code: string): Promise<Payable> {
    const o = await this.orders.findOne({ where: { code: code.trim().toUpperCase() } });
    if (!o) throw new NotFoundException("Order not found.");
    if (o.status === "CANCELLED") throw new BadRequestException("This order was cancelled.");
    return { kind: "order", id: o.id, businessId: o.businessId, code: o.code, totalMinor: o.totalMinor, paidMinor: o.paidMinor, label: `Order ${o.code}`, allowAdvance: false };
  }

  forBooking(code: string, phone: string, dto: StartPaymentDto) {
    return this.payableBooking(code, phone || dto.phone || "").then((p) => this.start(p, dto.method));
  }

  forOrder(code: string, dto: StartPaymentDto) {
    return this.payableOrder(code).then((p) => this.start(p, dto.method));
  }

  /** How much to ask for now: the advance share of the first payment, otherwise whatever is still due. */
  private amountDue(p: Payable, advancePercent: number): number {
    const due = p.totalMinor - p.paidMinor;
    if (due <= 0) throw new ConflictException("Nothing is due: this is already paid.");
    if (p.allowAdvance && advancePercent > 0 && p.paidMinor === 0) return Math.min(due, Math.max(1, Math.ceil((p.totalMinor * advancePercent) / 100)));
    return due;
  }

  private async start(p: Payable, method: PaymentMethod) {
    const business = await this.businesses.findOneOrFail({ where: { id: p.businessId } });
    const settings = await this.settingsRepo.findOne({ where: { businessId: p.businessId } });
    if (!settings || !settings.enabledMethods.includes(method)) throw new BadRequestException("This payment method is not available for this business.");
    const amountMinor = this.amountDue(p, settings.advancePercent);
    const ref = p.kind === "booking" ? { bookingId: p.id, orderId: null } : { bookingId: null, orderId: p.id };
    const base = this.payments.create({ businessId: p.businessId, method, amountMinor, currency: business.currency, status: "CREATED", ...ref });

    if (method === "CASH") {
      const payment = await this.payments.save(base);
      return { payment: this.view(payment), instructions: "Pay at the venue. The team will mark it as paid." };
    }

    if (method === "UPI_QR") {
      const payment = await this.payments.save(base);
      const link = this.upiLink(settings, amountMinor, p.label, p.code);
      return {
        payment: this.view(payment),
        upi: { link, qrDataUrl: await QRCode.toDataURL(link, { margin: 1, width: 320 }), payeeName: settings.upiName ?? business.name, upiId: settings.upiId, amountMinor },
        instructions: "Scan with any UPI app and pay, then enter the transaction (UTR) number so the team can verify it.",
      };
    }

    // RAZORPAY
    const secret = decrypt(settings.razorpayKeySecretEnc!);
    const order = await this.razorpay.createOrder(settings.razorpayKeyId!, secret, { amountMinor, currency: business.currency, receipt: p.code, notes: { businessId: p.businessId, [p.kind]: p.code } });
    base.externalId = order.id;
    const payment = await this.payments.save(base);
    return { payment: this.view(payment), razorpay: { keyId: settings.razorpayKeyId, orderId: order.id, amountMinor: order.amount, currency: order.currency, name: business.name, description: p.label } };
  }

  private upiLink(s: PaymentSettings, amountMinor: number, note: string, ref: string) {
    const q = new URLSearchParams({ pa: s.upiId!, pn: s.upiName ?? "Payee", am: (amountMinor / 100).toFixed(2), cu: "INR", tn: note.slice(0, 40), tr: ref });
    return `upi://pay?${q.toString().replace(/\+/g, "%20")}`;
  }

  // ---- customer steps after paying
  async submitUpiReference(paymentId: string, reference: string) {
    const p = await this.payments.findOne({ where: { id: paymentId } });
    if (!p || p.method !== "UPI_QR") throw new NotFoundException("Payment not found.");
    if (p.status === "PAID") return this.view(p);
    if (!["CREATED", "REJECTED"].includes(p.status)) throw new ConflictException("This payment is already waiting for verification.");
    p.reference = reference.toUpperCase();
    p.status = "PENDING_VERIFICATION";
    return this.view(await this.payments.save(p));
  }

  async verifyRazorpay(orderId: string, paymentId: string, signature: string) {
    const p = await this.payments.findOne({ where: { externalId: orderId, method: "RAZORPAY" } });
    if (!p) throw new NotFoundException("Payment not found.");
    if (p.status === "PAID") return this.view(p);
    const settings = await this.settingsRepo.findOneOrFail({ where: { businessId: p.businessId } });
    if (!this.razorpay.verifyCheckout(orderId, paymentId, signature, decrypt(settings.razorpayKeySecretEnc!))) {
      p.status = "FAILED";
      await this.payments.save(p);
      throw new BadRequestException("The payment could not be verified.");
    }
    p.externalPaymentId = paymentId;
    return this.view(await this.markPaid(p));
  }

  /** Razorpay calls this when a payment is captured, even if the customer closed the page. */
  async razorpayWebhook(businessId: string, rawBody: Buffer, signature: string) {
    const settings = await this.settingsRepo.findOne({ where: { businessId } });
    if (!settings?.razorpayWebhookSecretEnc) throw new ForbiddenException("Webhook is not set up for this business.");
    if (!signature || !this.razorpay.verifyWebhook(rawBody, signature, decrypt(settings.razorpayWebhookSecretEnc))) throw new ForbiddenException("Bad signature.");
    const event = JSON.parse(rawBody.toString("utf8")) as { event: string; payload?: { payment?: { entity?: { id: string; order_id: string } } } };
    const entity = event.payload?.payment?.entity;
    if (["payment.captured", "order.paid"].includes(event.event) && entity?.order_id) {
      const p = await this.payments.findOne({ where: { externalId: entity.order_id, businessId } });
      if (p && p.status !== "PAID") {
        p.externalPaymentId = entity.id;
        await this.markPaid(p);
      }
    }
    return { ok: true };
  }

  // ---- staff
  list(businessId: string, status?: string) {
    return this.payments.find({ where: { businessId, ...(status && { status: status as Payment["status"] }) }, order: { createdAt: "DESC" }, take: 200 }).then((rows) => rows.map((p) => this.view(p)));
  }

  async confirm(businessId: string, id: string) {
    const p = await this.payments.findOne({ where: { id, businessId } });
    if (!p) throw new NotFoundException("Payment not found.");
    if (p.method === "RAZORPAY") throw new BadRequestException("Razorpay payments are confirmed automatically.");
    return this.view(await this.markPaid(p));
  }

  async reject(businessId: string, id: string) {
    const p = await this.payments.findOne({ where: { id, businessId } });
    if (!p) throw new NotFoundException("Payment not found.");
    if (p.status === "PAID") throw new BadRequestException("This payment is already confirmed.");
    p.status = "REJECTED";
    return this.view(await this.payments.save(p));
  }

  /** Staff record money they received at the counter. */
  async record(businessId: string, dto: RecordPaymentDto) {
    if (!dto.bookingId === !dto.orderId) throw new BadRequestException("Give either a bookingId or an orderId.");
    const business = await this.businesses.findOneOrFail({ where: { id: businessId } });
    let total: number;
    let paid: number;
    if (dto.bookingId) {
      const b = await this.bookings.findOne({ where: { id: dto.bookingId, businessId } });
      if (!b) throw new NotFoundException("Booking not found.");
      [total, paid] = [b.totalMinor, b.paidMinor];
    } else {
      const o = await this.orders.findOne({ where: { id: dto.orderId, businessId } });
      if (!o) throw new NotFoundException("Order not found.");
      [total, paid] = [o.totalMinor, o.paidMinor];
    }
    const due = total - paid;
    if (due <= 0) throw new ConflictException("Nothing is due: this is already paid.");
    const amountMinor = dto.amountMinor ?? due;
    if (amountMinor > due) throw new BadRequestException(`The amount is more than what is due (${due}).`);
    const payment = await this.payments.save(this.payments.create({ businessId, bookingId: dto.bookingId ?? null, orderId: dto.orderId ?? null, method: dto.method, amountMinor, currency: business.currency, status: "CREATED", reference: dto.reference ?? null }));
    return this.view(await this.markPaid(payment));
  }

  /** Marks a payment as received and updates the booking or order it belongs to. Safe to call twice. */
  async markPaid(p: Payment): Promise<Payment> {
    if (p.status !== "PAID") {
      p.status = "PAID";
      p.paidAt = new Date();
      await this.payments.save(p);
    }
    const paid = (await this.payments.find({ where: { ...(p.bookingId ? { bookingId: p.bookingId } : { orderId: p.orderId! }), status: "PAID" } })).reduce((n, x) => n + x.amountMinor, 0);
    if (p.bookingId) {
      const b = await this.bookings.findOneOrFail({ where: { id: p.bookingId } });
      b.paidMinor = paid;
      b.paymentStatus = paid >= b.totalMinor ? "PAID" : "PARTIAL";
      if (b.status === "PENDING") b.status = "CONFIRMED";
      await this.bookings.save(b);
    } else if (p.orderId) {
      const o = await this.orders.findOneOrFail({ where: { id: p.orderId } });
      o.paidMinor = paid;
      o.paymentStatus = paid >= o.totalMinor ? "PAID" : "PARTIAL";
      await this.orders.save(o);
    }
    return p;
  }

  view(p: Payment) {
    return { id: p.id, method: p.method, status: p.status, amountMinor: p.amountMinor, currency: p.currency, reference: p.reference, bookingId: p.bookingId, orderId: p.orderId, createdAt: p.createdAt, paidAt: p.paidAt };
  }
}

export const PAYMENT_METHOD_LIST = PAYMENT_METHODS;
