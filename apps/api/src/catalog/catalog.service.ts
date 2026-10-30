import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { isDate, minutesOf } from "../common/tz";
import { AvailabilityRule, Provider, Service, TimeOff } from "../entities";
import { CreateProviderDto, CreateServiceDto, SetAvailabilityDto, TimeOffDto, UpdateProviderDto, UpdateServiceDto } from "./catalog.dto";

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Service) private services: Repository<Service>,
    @InjectRepository(Provider) private providers: Repository<Provider>,
    @InjectRepository(AvailabilityRule) private rules: Repository<AvailabilityRule>,
    @InjectRepository(TimeOff) private timeOff: Repository<TimeOff>,
  ) {}

  // ---- services
  listServices(businessId: string, onlyActive = false) {
    return this.services.find({ where: { businessId, ...(onlyActive && { active: true }) }, order: { createdAt: "ASC" } });
  }

  async getService(businessId: string, id: string) {
    const s = await this.services.findOne({ where: { id, businessId } });
    if (!s) throw new NotFoundException("Service not found.");
    return s;
  }

  createService(businessId: string, dto: CreateServiceDto) {
    const mode = dto.mode ?? "SLOT";
    return this.services.save(
      this.services.create({
        businessId,
        name: dto.name.trim(),
        description: dto.description ?? null,
        mode,
        durationMinutes: dto.durationMinutes ?? 30,
        priceMinor: dto.priceMinor,
        capacity: mode === "STAY" ? (dto.capacity ?? 1) : 1,
        active: dto.active ?? true,
      }),
    );
  }

  async updateService(businessId: string, id: string, dto: UpdateServiceDto) {
    const s = await this.getService(businessId, id);
    Object.assign(s, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.services.save(s);
  }

  async deleteService(businessId: string, id: string) {
    const s = await this.getService(businessId, id);
    // Past bookings keep pointing at the service, so it is switched off instead of removed.
    s.active = false;
    await this.services.save(s);
    return { ok: true };
  }

  // ---- providers
  private async checkServiceIds(businessId: string, ids: string[]) {
    if (ids.length === 0) return;
    const found = await this.services.count({ where: { businessId, id: In(ids) } });
    if (found !== new Set(ids).size) throw new BadRequestException("One of the services does not belong to this business.");
  }

  async listProviders(businessId: string, onlyActive = false) {
    const list = await this.providers.find({ where: { businessId, ...(onlyActive && { active: true }) }, order: { createdAt: "ASC" } });
    const rules = list.length ? await this.rules.find({ where: { providerId: In(list.map((p) => p.id)) } }) : [];
    return list.map((p) => ({ ...p, availability: rules.filter((r) => r.providerId === p.id).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })).sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime)) }));
  }

  async getProvider(businessId: string, id: string) {
    const p = await this.providers.findOne({ where: { id, businessId } });
    if (!p) throw new NotFoundException("Provider not found.");
    return p;
  }

  async createProvider(businessId: string, dto: CreateProviderDto) {
    await this.checkServiceIds(businessId, dto.serviceIds);
    return this.providers.save(this.providers.create({ businessId, name: dto.name.trim(), title: dto.title ?? null, bio: dto.bio ?? null, serviceIds: [...new Set(dto.serviceIds)], userId: dto.userId ?? null, active: dto.active ?? true }));
  }

  async updateProvider(businessId: string, id: string, dto: UpdateProviderDto) {
    const p = await this.getProvider(businessId, id);
    if (dto.serviceIds) await this.checkServiceIds(businessId, dto.serviceIds);
    Object.assign(p, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.providers.save(p);
  }

  async deleteProvider(businessId: string, id: string) {
    const p = await this.getProvider(businessId, id);
    p.active = false;
    await this.providers.save(p);
    return { ok: true };
  }

  // ---- weekly hours and days off
  async setAvailability(businessId: string, providerId: string, dto: SetAvailabilityDto) {
    await this.getProvider(businessId, providerId);
    for (const r of dto.rules) {
      if (minutesOf(r.endTime) <= minutesOf(r.startTime)) throw new BadRequestException(`End time must be after start time (${r.startTime}–${r.endTime}).`);
    }
    // overlapping hours on the same day would offer the same slot twice
    const byDay = new Map<number, { s: number; e: number }[]>();
    for (const r of dto.rules) {
      const list = byDay.get(r.weekday) ?? [];
      const s = minutesOf(r.startTime);
      const e = minutesOf(r.endTime);
      if (list.some((x) => s < x.e && e > x.s)) throw new BadRequestException("Working hours on the same day must not overlap.");
      list.push({ s, e });
      byDay.set(r.weekday, list);
    }
    await this.rules.delete({ providerId });
    await this.rules.save(dto.rules.map((r) => this.rules.create({ providerId, ...r })));
    return { ok: true, rules: dto.rules.length };
  }

  async addTimeOff(businessId: string, providerId: string, dto: TimeOffDto) {
    await this.getProvider(businessId, providerId);
    if (!isDate(dto.date)) throw new BadRequestException("Invalid date.");
    return this.timeOff.save(this.timeOff.create({ providerId, date: dto.date, reason: dto.reason ?? null }));
  }

  async listTimeOff(businessId: string, providerId: string) {
    await this.getProvider(businessId, providerId);
    return this.timeOff.find({ where: { providerId }, order: { date: "ASC" } });
  }

  async removeTimeOff(businessId: string, providerId: string, id: string) {
    await this.getProvider(businessId, providerId);
    await this.timeOff.delete({ id, providerId });
    return { ok: true };
  }
}
