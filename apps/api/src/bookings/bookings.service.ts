import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { Between, DataSource, FindOptionsWhere, In, LessThan, MoreThan, Repository } from "typeorm";
import { ACTIVE_BOOKING, type BookingStatus } from "../common/enums";
import { shortCode } from "../common/crypto";
import { IS_PG } from "../common/db";
import { samePhone } from "../common/phone";
import { addDays, zonedToUtc } from "../common/tz";
import { Booking, Business, Provider, Service } from "../entities";
import { AvailabilityService } from "./availability.service";
import { CreateBookingDto } from "./bookings.dto";

const digits = (s: string) => s.replace(/\D/g, "");

/** Allowed next statuses: finished bookings cannot be reopened. */
const NEXT: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectDataSource() private ds: DataSource,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(Service) private services: Repository<Service>,
    @InjectRepository(Provider) private providers: Repository<Provider>,
    @InjectRepository(Business) private businesses: Repository<Business>,
    private availability: AvailabilityService,
  ) {}

  view(b: Booking) {
    return {
      id: b.id,
      code: b.code,
      businessId: b.businessId,
      status: b.status,
      paymentStatus: b.paymentStatus,
      startAt: b.startAt,
      endAt: b.endAt,
      quantity: b.quantity,
      guests: b.guests,
      guestName: b.guestName,
      guestPhone: b.guestPhone,
      guestEmail: b.guestEmail,
      notes: b.notes,
      totalMinor: b.totalMinor,
      paidMinor: b.paidMinor,
      service: b.service ? { id: b.service.id, name: b.service.name, mode: b.service.mode, durationMinutes: b.service.durationMinutes, priceMinor: b.service.priceMinor } : undefined,
      provider: b.provider ? { id: b.provider.id, name: b.provider.name, title: b.provider.title } : null,
      createdAt: b.createdAt,
    };
  }

  private async uniqueCode(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = shortCode(6);
      if (!(await this.bookings.exists({ where: { code } }))) return code;
    }
    return shortCode(8);
  }

  /**
   * Creates a booking. The availability check and the insert run in one transaction (and, on PostgreSQL, under a
   * lock for the business), so two customers cannot take the same slot or the last room.
   */
  async create(business: Business, dto: CreateBookingDto, customerId: string | null, opts: { staff?: boolean } = {}) {
    if (!business.modules.includes("APPOINTMENTS")) throw new BadRequestException("This business does not take appointments.");
    const service = await this.services.findOne({ where: { id: dto.serviceId, businessId: business.id, active: true } });
    if (!service) throw new NotFoundException("Service not found.");

    const booking = await this.ds.transaction(async (m) => {
      if (IS_PG) await m.query("SELECT pg_advisory_xact_lock(hashtext($1))", [business.id]);
      let startAt: Date;
      let endAt: Date;
      let providerId: string | null = null;
      let quantity = 1;
      let totalMinor = service.priceMinor;

      if (service.mode === "SLOT") {
        if (!dto.date || !dto.time) throw new BadRequestException("Choose a date and a time.");
        const start = zonedToUtc(dto.date, dto.time, business.timezone);
        const slots = await this.availability.slots(business, service, dto.date, dto.providerId, m, opts.staff);
        const slot = slots.find((s) => s.start === start.toISOString());
        if (!slot) throw new ConflictException("Sorry, that time is no longer available. Please pick another.");
        providerId = slot.providerId;
        startAt = start;
        endAt = new Date(slot.end);
      } else {
        if (!dto.checkIn || !dto.checkOut) throw new BadRequestException("Choose check-in and check-out dates.");
        quantity = dto.rooms ?? 1;
        const r = await this.availability.rooms(business, service, dto.checkIn, dto.checkOut, m);
        if (new Date() > r.endAt) throw new BadRequestException("These dates are in the past.");
        if (r.available < quantity) throw new ConflictException(r.available === 0 ? "No rooms of this type are free on those dates." : `Only ${r.available} room(s) of this type are free on those dates.`);
        startAt = r.startAt;
        endAt = r.endAt;
        totalMinor = r.totalMinor * quantity;
      }

      const b = m.getRepository(Booking).create({
        code: await this.uniqueCode(),
        businessId: business.id,
        serviceId: service.id,
        providerId,
        customerId,
        guestName: dto.guestName.trim(),
        guestPhone: dto.guestPhone.trim(),
        guestEmail: dto.guestEmail?.trim().toLowerCase() ?? null,
        startAt,
        endAt,
        quantity,
        guests: dto.guests ?? 1,
        notes: dto.notes ?? null,
        totalMinor,
        paidMinor: 0,
        paymentStatus: "UNPAID",
        status: opts.staff || business.settings.autoConfirm ? "CONFIRMED" : "PENDING",
      });
      return m.getRepository(Booking).save(b);
    });
    return this.byId(business.id, booking.id);
  }

  async byId(businessId: string, id: string) {
    const b = await this.bookings.findOne({ where: { id, businessId }, relations: { service: true, provider: true } });
    if (!b) throw new NotFoundException("Booking not found.");
    return this.view(b);
  }

  /** Staff list. `from` and `to` are local dates in the business time zone. */
  async list(business: Business, f: { from?: string; to?: string; status?: string; providerId?: string; q?: string }, onlyProviderUserId?: string) {
    const where: FindOptionsWhere<Booking> = { businessId: business.id };
    if (f.status) where.status = f.status as BookingStatus;
    if (f.providerId) where.providerId = f.providerId;
    if (onlyProviderUserId) {
      const mine = await this.providers.find({ where: { businessId: business.id, userId: onlyProviderUserId } });
      where.providerId = In(mine.map((p) => p.id).concat("none"));
    }
    if (f.from && f.to) where.startAt = Between(zonedToUtc(f.from, "00:00", business.timezone), zonedToUtc(addDays(f.to, 1), "00:00", business.timezone));
    else if (f.from) where.startAt = MoreThan(zonedToUtc(f.from, "00:00", business.timezone));
    else if (f.to) where.startAt = LessThan(zonedToUtc(addDays(f.to, 1), "00:00", business.timezone));
    const rows = await this.bookings.find({ where, relations: { service: true, provider: true }, order: { startAt: "ASC" }, take: 500 });
    const q = f.q?.trim().toLowerCase();
    return rows.filter((b) => !q || b.code.toLowerCase().includes(q) || b.guestName.toLowerCase().includes(q) || digits(b.guestPhone).includes(digits(q) || "x")).map((b) => this.view(b));
  }

  async setStatus(business: Business, id: string, status: BookingStatus, onlyProviderUserId?: string) {
    const b = await this.bookings.findOne({ where: { id, businessId: business.id }, relations: { service: true, provider: true } });
    if (!b) throw new NotFoundException("Booking not found.");
    if (onlyProviderUserId && b.provider?.userId !== onlyProviderUserId) throw new ForbiddenException("You can only update your own bookings.");
    if (!NEXT[b.status].includes(status)) throw new BadRequestException(`A ${b.status.toLowerCase()} booking cannot become ${status.toLowerCase()}.`);
    b.status = status;
    await this.bookings.save(b);
    return this.view(b);
  }

  // ---- customers
  mine(userId: string) {
    return this.bookings.find({ where: { customerId: userId }, relations: { service: true, provider: true }, order: { startAt: "DESC" }, take: 200 }).then((rows) => rows.map((b) => this.view(b)));
  }

  /** Guests look up their booking with its code and the phone number they used. */
  async lookup(code: string, phone: string) {
    const b = await this.bookings.findOne({ where: { code: code.trim().toUpperCase() }, relations: { service: true, provider: true } });
    // same answer for "no such booking" and "wrong phone", so codes cannot be guessed
    if (!b || !samePhone(b.guestPhone, phone ?? "")) throw new NotFoundException("No booking found with that code and phone number.");
    const business = await this.businesses.findOneOrFail({ where: { id: b.businessId } });
    return { ...this.view(b), business: { id: business.id, slug: business.slug, name: business.name, phone: business.phone, address: business.address, timezone: business.timezone } };
  }

  async cancel(b: Booking) {
    if (!["PENDING", "CONFIRMED"].includes(b.status)) throw new BadRequestException("This booking can no longer be cancelled.");
    if (b.startAt < new Date()) throw new BadRequestException("This booking has already started.");
    b.status = "CANCELLED";
    await this.bookings.save(b);
    return this.view(b);
  }

  async cancelByCode(code: string, phone: string) {
    const found = await this.lookup(code, phone);
    const b = await this.bookings.findOneOrFail({ where: { id: found.id }, relations: { service: true, provider: true } });
    return this.cancel(b);
  }

  async cancelMine(userId: string, id: string) {
    const b = await this.bookings.findOne({ where: { id, customerId: userId }, relations: { service: true, provider: true } });
    if (!b) throw new NotFoundException("Booking not found.");
    return this.cancel(b);
  }
}
