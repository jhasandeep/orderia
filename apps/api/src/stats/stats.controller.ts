import { Controller, Get, Param } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { InjectRepository } from "@nestjs/typeorm";
import { Between, In, Repository } from "typeorm";
import { BusinessAccess } from "../common/auth";
import { addDays, localDate, zonedToUtc } from "../common/tz";
import { BusinessesService } from "../businesses/businesses.service";
import { Booking, DiningOrder, Payment } from "../entities";

/** Numbers for the dashboard's first screen. */
@ApiTags("stats")
@ApiBearerAuth()
@Controller("businesses/:businessId/stats")
export class StatsController {
  constructor(
    private businesses: BusinessesService,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(DiningOrder) private orders: Repository<DiningOrder>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
  ) {}

  @BusinessAccess("OWNER", "MANAGER", "RECEPTION") @Get()
  async today(@Param("businessId") id: string) {
    const b = await this.businesses.get(id);
    const today = localDate(new Date(), b.timezone);
    const start = zonedToUtc(today, "00:00", b.timezone);
    const end = zonedToUtc(addDays(today, 1), "00:00", b.timezone);
    const [todays, activeOrders, paidToday, toVerify, upcoming] = await Promise.all([
      this.bookings.find({ where: { businessId: id, startAt: Between(start, end) } }),
      this.orders.count({ where: { businessId: id, status: In(["PLACED", "PREPARING", "READY"]) } }),
      this.payments.find({ where: { businessId: id, status: "PAID", paidAt: Between(start, end) } }),
      this.payments.count({ where: { businessId: id, status: "PENDING_VERIFICATION" } }),
      this.bookings.count({ where: { businessId: id, status: In(["PENDING", "CONFIRMED"]), startAt: Between(end, new Date(end.getTime() + 7 * 86_400_000)) } }),
    ]);
    return {
      date: today,
      bookingsToday: todays.filter((x) => x.status !== "CANCELLED").length,
      pendingBookings: todays.filter((x) => x.status === "PENDING").length,
      completedToday: todays.filter((x) => x.status === "COMPLETED").length,
      upcomingNextSevenDays: upcoming,
      activeOrders,
      revenueTodayMinor: paidToday.reduce((n, p) => n + p.amountMinor, 0),
      paymentsToVerify: toVerify,
    };
  }
}
