import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as bcrypt from "bcryptjs";
import { ILike, Repository } from "typeorm";
import { DEFAULT_MODULES } from "../common/enums";
import { shortCode } from "../common/crypto";
import { slugify } from "../common/slug";
import { Business, BusinessSettings, Membership, PaymentSettings, User } from "../entities";
import { AddTeamMemberDto, CreateBusinessDto, UpdateBusinessDto } from "./businesses.dto";

const DEFAULT_SETTINGS: BusinessSettings = { slotIntervalMinutes: 30, minNoticeMinutes: 60, autoConfirm: true, checkInTime: "14:00", checkOutTime: "11:00" };

const isZone = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business) private businesses: Repository<Business>,
    @InjectRepository(Membership) private memberships: Repository<Membership>,
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(PaymentSettings) private paymentSettings: Repository<PaymentSettings>,
  ) {}

  async create(userId: string, dto: CreateBusinessDto) {
    if (dto.timezone && !isZone(dto.timezone)) throw new BadRequestException("Unknown time zone.");
    let slug = dto.slug ?? slugify(dto.name);
    if (!slug) throw new BadRequestException("Choose a name with letters or numbers.");
    if (await this.businesses.findOne({ where: { slug } })) {
      if (dto.slug) throw new ConflictException("That web address is taken. Try another.");
      slug = `${slug}-${shortCode(4).toLowerCase()}`;
    }
    const business = await this.businesses.save(
      this.businesses.create({
        slug,
        name: dto.name.trim(),
        type: dto.type,
        description: dto.description ?? null,
        phone: dto.phone ?? null,
        address: dto.address ?? null,
        city: dto.city ?? null,
        timezone: dto.timezone ?? "Asia/Kolkata",
        modules: dto.modules?.length ? dto.modules : DEFAULT_MODULES[dto.type],
        settings: { ...DEFAULT_SETTINGS },
      }),
    );
    await this.memberships.save(this.memberships.create({ userId, businessId: business.id, role: "OWNER" }));
    // Cash is on from the start, so a new business can take bookings immediately.
    await this.paymentSettings.save(this.paymentSettings.create({ businessId: business.id, enabledMethods: ["CASH"], advancePercent: 0 }));
    return business;
  }

  /** Public directory. */
  list(filter: { type?: string; city?: string; q?: string }) {
    const where: Record<string, unknown> = { active: true };
    if (filter.type) where.type = filter.type;
    if (filter.city) where.city = ILike(filter.city);
    const base = Object.keys(where).length ? where : {};
    return this.businesses
      .find({ where: filter.q ? [{ ...base, name: ILike(`%${filter.q}%`) }, { ...base, description: ILike(`%${filter.q}%`) }] : base, order: { name: "ASC" }, take: 100 })
      .then((rows) => rows.map((b) => ({ id: b.id, slug: b.slug, name: b.name, type: b.type, city: b.city, description: b.description, modules: b.modules })));
  }

  async bySlug(slug: string) {
    const b = await this.businesses.findOne({ where: { slug, active: true } });
    if (!b) throw new NotFoundException("Business not found.");
    return b;
  }

  async get(id: string) {
    const b = await this.businesses.findOne({ where: { id } });
    if (!b) throw new NotFoundException("Business not found.");
    return b;
  }

  async update(id: string, dto: UpdateBusinessDto) {
    const b = await this.get(id);
    if (dto.timezone && !isZone(dto.timezone)) throw new BadRequestException("Unknown time zone.");
    const { slotIntervalMinutes, minNoticeMinutes, autoConfirm, ...rest } = dto;
    Object.assign(b, Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)));
    b.settings = {
      ...b.settings,
      ...(slotIntervalMinutes !== undefined && { slotIntervalMinutes }),
      ...(minNoticeMinutes !== undefined && { minNoticeMinutes }),
      ...(autoConfirm !== undefined && { autoConfirm }),
    };
    return this.businesses.save(b);
  }

  async team(businessId: string) {
    const rows = await this.memberships.find({ where: { businessId }, relations: { user: true }, order: { createdAt: "ASC" } });
    return rows.map((m) => ({ id: m.id, role: m.role, user: { id: m.user.id, name: m.user.name, email: m.user.email, phone: m.user.phone } }));
  }

  /** Adds an existing account, or creates one with the given password. */
  async addTeamMember(businessId: string, dto: AddTeamMemberDto) {
    const email = dto.email.trim().toLowerCase();
    let user = await this.users.findOne({ where: { email } });
    if (!user) {
      if (!dto.password) throw new BadRequestException("This person has no account yet: set a password for them.");
      user = await this.users.save(this.users.create({ email, name: dto.name.trim(), phone: dto.phone ?? null, passwordHash: await bcrypt.hash(dto.password, 10) }));
    }
    const existing = await this.memberships.findOne({ where: { userId: user.id, businessId } });
    if (existing) throw new ConflictException("This person is already on the team.");
    const m = await this.memberships.save(this.memberships.create({ userId: user.id, businessId, role: dto.role }));
    return { id: m.id, role: m.role, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } };
  }

  async removeTeamMember(businessId: string, membershipId: string) {
    const m = await this.memberships.findOne({ where: { id: membershipId, businessId } });
    if (!m) throw new NotFoundException("Team member not found.");
    if (m.role === "OWNER") throw new BadRequestException("The owner cannot be removed.");
    await this.memberships.delete(m.id);
    return { ok: true };
  }
}
