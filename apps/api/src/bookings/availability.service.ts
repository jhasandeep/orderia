import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { EntityManager, In, LessThan, MoreThan, Repository } from "typeorm";
import { ACTIVE_BOOKING } from "../common/enums";
import { addDays, isDate, minutesOf, timeOf, weekdayOf, zonedToUtc } from "../common/tz";
import { AvailabilityRule, Booking, Business, Provider, Service, TimeOff } from "../entities";

export interface Slot {
  start: string;
  end: string;
  providerId: string;
  providerName: string;
}

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => aStart < bEnd && aEnd > bStart;

/** Works out which time slots and rooms are still free. */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(Provider) private providers: Repository<Provider>,
    @InjectRepository(AvailabilityRule) private rules: Repository<AvailabilityRule>,
    @InjectRepository(TimeOff) private timeOff: Repository<TimeOff>,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(Service) private services: Repository<Service>,
  ) {}

  /**
   * Free start times on one local date for a SLOT service. Without `providerId` every provider who does the service is
   * considered and each start time appears once, with the first provider who is free.
   * `manager` lets booking creation run the same check inside its transaction.
   */
  async slots(business: Business, service: Service, date: string, providerId?: string, manager?: EntityManager, ignoreNotice = false): Promise<Slot[]> {
    if (service.mode !== "SLOT") throw new BadRequestException("This is a stay: choose check-in and check-out dates instead.");
    if (!isDate(date)) throw new BadRequestException("Choose a date (YYYY-MM-DD).");
    const providerRepo = manager?.getRepository(Provider) ?? this.providers;
    const ruleRepo = manager?.getRepository(AvailabilityRule) ?? this.rules;
    const timeOffRepo = manager?.getRepository(TimeOff) ?? this.timeOff;
    const bookingRepo = manager?.getRepository(Booking) ?? this.bookings;

    const tz = business.timezone;
    const all = await providerRepo.find({ where: { businessId: business.id, active: true, ...(providerId && { id: providerId }) } });
    const eligible = all.filter((p) => p.serviceIds.includes(service.id));
    if (providerId && eligible.length === 0) throw new NotFoundException("This provider does not offer this service.");
    if (eligible.length === 0) return [];

    const ids = eligible.map((p) => p.id);
    const weekday = weekdayOf(date);
    const [rules, off] = await Promise.all([ruleRepo.find({ where: { providerId: In(ids), weekday } }), timeOffRepo.find({ where: { providerId: In(ids), date } })]);
    const dayStart = zonedToUtc(date, "00:00", tz);
    const dayEnd = zonedToUtc(addDays(date, 1), "00:00", tz);
    const busy = await bookingRepo.find({ where: { providerId: In(ids), status: In([...ACTIVE_BOOKING]), startAt: LessThan(dayEnd), endAt: MoreThan(dayStart) } });

    const earliest = ignoreNotice ? new Date(0) : new Date(Date.now() + business.settings.minNoticeMinutes * 60_000);
    const step = Math.max(5, business.settings.slotIntervalMinutes);
    const duration = service.durationMinutes;
    const byStart = new Map<string, Slot>();

    for (const p of eligible) {
      if (off.some((o) => o.providerId === p.id)) continue;
      const mine = busy.filter((b) => b.providerId === p.id);
      for (const r of rules.filter((x) => x.providerId === p.id)) {
        for (let m = minutesOf(r.startTime); m + duration <= minutesOf(r.endTime); m += step) {
          const start = zonedToUtc(date, timeOf(m), tz);
          const end = new Date(start.getTime() + duration * 60_000);
          if (start < earliest) continue;
          if (mine.some((b) => overlaps(start, end, b.startAt, b.endAt))) continue;
          const key = start.toISOString();
          if (!byStart.has(key)) byStart.set(key, { start: key, end: end.toISOString(), providerId: p.id, providerName: p.name });
        }
      }
    }
    return [...byStart.values()].sort((a, b) => a.start.localeCompare(b.start));
  }

  /** Rooms still free for every night between check-in (included) and check-out (not included). */
  async rooms(business: Business, service: Service, checkIn: string, checkOut: string, manager?: EntityManager) {
    if (service.mode !== "STAY") throw new BadRequestException("This service is booked by time slot, not by nights.");
    if (!isDate(checkIn) || !isDate(checkOut)) throw new BadRequestException("Choose check-in and check-out dates (YYYY-MM-DD).");
    if (checkOut <= checkIn) throw new BadRequestException("Check-out must be after check-in.");
    const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
    if (nights > 60) throw new BadRequestException("Stays longer than 60 nights need to be arranged with the hotel.");
    const tz = business.timezone;
    const start = zonedToUtc(checkIn, business.settings.checkInTime, tz);
    const end = zonedToUtc(checkOut, business.settings.checkOutTime, tz);
    const repo = manager?.getRepository(Booking) ?? this.bookings;
    const busy = await repo.find({ where: { serviceId: service.id, status: In([...ACTIVE_BOOKING]), startAt: LessThan(end), endAt: MoreThan(start) } });
    // the busiest night decides how many rooms are free for the whole stay
    let free = service.capacity;
    for (let n = 0; n < nights; n++) {
      const nightStart = zonedToUtc(addDays(checkIn, n), business.settings.checkInTime, tz);
      const nightEnd = zonedToUtc(addDays(checkIn, n + 1), business.settings.checkInTime, tz);
      const used = busy.filter((b) => overlaps(nightStart, nightEnd, b.startAt, b.endAt)).reduce((sum, b) => sum + b.quantity, 0);
      free = Math.min(free, service.capacity - used);
    }
    return { nights, available: Math.max(0, free), pricePerNightMinor: service.priceMinor, totalMinor: service.priceMinor * nights, startAt: start, endAt: end };
  }
}
