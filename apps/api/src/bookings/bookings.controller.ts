import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BusinessAccess, CurrentMembership, CurrentUser, Public, type AuthUser } from "../common/auth";
import { Membership, PaymentSettings } from "../entities";
import { BusinessesService } from "../businesses/businesses.service";
import { CatalogService } from "../catalog/catalog.service";
import { AvailabilityService } from "./availability.service";
import { CancelDto, CreateBookingDto, UpdateBookingStatusDto } from "./bookings.dto";
import { BookingsService } from "./bookings.service";

/** Everything a customer can do without an account. */
@ApiTags("public")
@Controller("public")
export class PublicBookingsController {
  constructor(
    private businesses: BusinessesService,
    private catalog: CatalogService,
    private availability: AvailabilityService,
    private bookings: BookingsService,
    @InjectRepository(PaymentSettings) private paymentSettings: Repository<PaymentSettings>,
  ) {}

  /** The business page: details, what it offers, who works there and how it can be paid. */
  @Public() @Get("businesses/:slug")
  async page(@Param("slug") slug: string) {
    const b = await this.businesses.bySlug(slug);
    const [services, providers, pay] = await Promise.all([this.catalog.listServices(b.id, true), this.catalog.listProviders(b.id, true), this.paymentSettings.findOne({ where: { businessId: b.id } })]);
    return {
      business: { id: b.id, slug: b.slug, name: b.name, type: b.type, description: b.description, phone: b.phone, address: b.address, city: b.city, timezone: b.timezone, currency: b.currency, modules: b.modules, checkInTime: b.settings.checkInTime, checkOutTime: b.settings.checkOutTime },
      services: services.map((s) => ({ id: s.id, name: s.name, description: s.description, mode: s.mode, durationMinutes: s.durationMinutes, priceMinor: s.priceMinor, capacity: s.capacity })),
      providers: providers.map((p) => ({ id: p.id, name: p.name, title: p.title, bio: p.bio, serviceIds: p.serviceIds })),
      payment: { methods: pay?.enabledMethods ?? ["CASH"], advancePercent: pay?.advancePercent ?? 0 },
    };
  }

  @Public() @Get("businesses/:slug/availability")
  async slots(@Param("slug") slug: string, @Query("serviceId") serviceId: string, @Query("date") date: string, @Query("providerId") providerId?: string) {
    const b = await this.businesses.bySlug(slug);
    const service = await this.catalog.getService(b.id, serviceId);
    return { date, timezone: b.timezone, slots: await this.availability.slots(b, service, date, providerId || undefined) };
  }

  @Public() @Get("businesses/:slug/rooms")
  async rooms(@Param("slug") slug: string, @Query("serviceId") serviceId: string, @Query("checkIn") checkIn: string, @Query("checkOut") checkOut: string) {
    const b = await this.businesses.bySlug(slug);
    const service = await this.catalog.getService(b.id, serviceId);
    const r = await this.availability.rooms(b, service, checkIn, checkOut);
    return { nights: r.nights, available: r.available, pricePerNightMinor: r.pricePerNightMinor, totalMinor: r.totalMinor };
  }

  /** Book as a guest, or as yourself when a token is sent. */
  @Public() @Post("businesses/:slug/bookings")
  async book(@Param("slug") slug: string, @Body() dto: CreateBookingDto, @CurrentUser() user: AuthUser | null) {
    const b = await this.businesses.bySlug(slug);
    return this.bookings.create(b, dto, user?.userId ?? null);
  }

  @Public() @Get("bookings/:code")
  lookup(@Param("code") code: string, @Query("phone") phone: string) {
    return this.bookings.lookup(code, phone);
  }

  @Public() @Post("bookings/:code/cancel")
  cancel(@Param("code") code: string, @Body() dto: CancelDto) {
    return this.bookings.cancelByCode(code, dto.phone ?? "");
  }
}

@ApiTags("bookings")
@ApiBearerAuth()
@Controller()
export class MyBookingsController {
  constructor(private bookings: BookingsService) {}

  @Get("me/bookings")
  mine(@CurrentUser() user: AuthUser) {
    return this.bookings.mine(user.userId);
  }

  @Post("me/bookings/:id/cancel")
  cancel(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.bookings.cancelMine(user.userId, id);
  }
}

/** The team's view of bookings. Providers only see and change their own. */
@ApiTags("bookings")
@ApiBearerAuth()
@Controller("businesses/:businessId/bookings")
export class StaffBookingsController {
  constructor(
    private businesses: BusinessesService,
    private bookings: BookingsService,
  ) {}

  @BusinessAccess("OWNER", "MANAGER", "RECEPTION", "PROVIDER") @Get()
  async list(@Param("businessId") id: string, @CurrentMembership() m: Membership, @CurrentUser() user: AuthUser, @Query("from") from?: string, @Query("to") to?: string, @Query("status") status?: string, @Query("providerId") providerId?: string, @Query("q") q?: string) {
    const b = await this.businesses.get(id);
    return this.bookings.list(b, { from, to, status, providerId, q }, m.role === "PROVIDER" ? user.userId : undefined);
  }

  /** Walk-in or phone booking taken by staff. */
  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Post()
  async create(@Param("businessId") id: string, @Body() dto: CreateBookingDto) {
    const b = await this.businesses.get(id);
    return this.bookings.create(b, dto, null, { staff: true });
  }

  @BusinessAccess("OWNER", "MANAGER", "RECEPTION", "PROVIDER") @Patch(":bookingId/status")
  async status(@Param("businessId") id: string, @Param("bookingId") bookingId: string, @Body() dto: UpdateBookingStatusDto, @CurrentMembership() m: Membership, @CurrentUser() user: AuthUser) {
    const b = await this.businesses.get(id);
    return this.bookings.setStatus(b, bookingId, dto.status, m.role === "PROVIDER" ? user.userId : undefined);
  }
}
