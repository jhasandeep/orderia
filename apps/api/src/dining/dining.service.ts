import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import * as QRCode from "qrcode";
import { In, LessThan, MoreThan, Repository } from "typeorm";
import { randomToken, shortCode } from "../common/crypto";
import type { OrderStatus, ReservationStatus } from "../common/enums";
import { addDays, zonedToUtc } from "../common/tz";
import { Business, DiningOrder, DiningOrderItem, DiningTable, MenuCategory, MenuItem, Payment, PaymentSettings, TableReservation } from "../entities";
import { CategoryDto, CreateMenuItemDto, CreateTableDto, PlaceOrderDto, ReserveTableDto, UpdateMenuItemDto, UpdateTableDto } from "./dining.dto";

const NEXT_ORDER: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

const RESERVATION_HOLDS = ["REQUESTED", "CONFIRMED", "SEATED"] as const;

@Injectable()
export class DiningService {
  constructor(
    @InjectRepository(Business) private businesses: Repository<Business>,
    @InjectRepository(DiningTable) private tables: Repository<DiningTable>,
    @InjectRepository(MenuCategory) private categories: Repository<MenuCategory>,
    @InjectRepository(MenuItem) private items: Repository<MenuItem>,
    @InjectRepository(DiningOrder) private orders: Repository<DiningOrder>,
    @InjectRepository(DiningOrderItem) private orderItems: Repository<DiningOrderItem>,
    @InjectRepository(TableReservation) private reservations: Repository<TableReservation>,
    @InjectRepository(PaymentSettings) private paymentSettings: Repository<PaymentSettings>,
    @InjectRepository(Payment) private payments: Repository<Payment>,
  ) {}

  private requireDining(b: Business) {
    if (!b.modules.includes("DINING")) throw new BadRequestException("This business does not use QR table ordering.");
  }

  // ---- tables and QR
  async createTable(businessId: string, dto: CreateTableDto) {
    const label = dto.label.trim();
    if (await this.tables.exists({ where: { businessId, label } })) throw new ConflictException(`A table named "${label}" already exists.`);
    return this.tables.save(this.tables.create({ businessId, label, seats: dto.seats ?? 2, qrToken: randomToken(), active: true }));
  }

  listTables(businessId: string) {
    return this.tables.find({ where: { businessId }, order: { label: "ASC" } });
  }

  private async table(businessId: string, id: string) {
    const t = await this.tables.findOne({ where: { id, businessId } });
    if (!t) throw new NotFoundException("Table not found.");
    return t;
  }

  async updateTable(businessId: string, id: string, dto: UpdateTableDto) {
    const t = await this.table(businessId, id);
    Object.assign(t, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.tables.save(t);
  }

  /** Makes the old QR code stop working (for example if a photo of it was shared). */
  async rotateToken(businessId: string, id: string) {
    const t = await this.table(businessId, id);
    t.qrToken = randomToken();
    return this.tables.save(t);
  }

  async qr(businessId: string, id: string) {
    const t = await this.table(businessId, id);
    const url = `${process.env.PUBLIC_WEB_URL ?? "http://localhost:3000"}/t/${t.qrToken}`;
    return { table: { id: t.id, label: t.label, seats: t.seats }, url, qrDataUrl: await QRCode.toDataURL(url, { margin: 2, width: 480 }) };
  }

  // ---- menu
  async menu(businessId: string, onlyAvailable = false) {
    const [categories, items] = await Promise.all([this.categories.find({ where: { businessId }, order: { sort: "ASC", name: "ASC" } }), this.items.find({ where: { businessId, ...(onlyAvailable && { available: true }) }, order: { name: "ASC" } })]);
    return { categories, items };
  }

  createCategory(businessId: string, dto: CategoryDto) {
    return this.categories.save(this.categories.create({ businessId, name: dto.name.trim(), sort: dto.sort ?? 0 }));
  }

  async updateCategory(businessId: string, id: string, dto: CategoryDto) {
    const c = await this.categories.findOne({ where: { id, businessId } });
    if (!c) throw new NotFoundException("Category not found.");
    c.name = dto.name.trim();
    if (dto.sort !== undefined) c.sort = dto.sort;
    return this.categories.save(c);
  }

  async deleteCategory(businessId: string, id: string) {
    await this.items.update({ businessId, categoryId: id }, { categoryId: null });
    await this.categories.delete({ id, businessId });
    return { ok: true };
  }

  private async checkCategory(businessId: string, categoryId?: string) {
    if (categoryId && !(await this.categories.exists({ where: { id: categoryId, businessId } }))) throw new BadRequestException("Unknown category.");
  }

  async createItem(businessId: string, dto: CreateMenuItemDto) {
    await this.checkCategory(businessId, dto.categoryId);
    return this.items.save(this.items.create({ businessId, categoryId: dto.categoryId ?? null, name: dto.name.trim(), description: dto.description ?? null, priceMinor: dto.priceMinor, veg: dto.veg ?? true, available: dto.available ?? true }));
  }

  async updateItem(businessId: string, id: string, dto: UpdateMenuItemDto) {
    const item = await this.items.findOne({ where: { id, businessId } });
    if (!item) throw new NotFoundException("Menu item not found.");
    await this.checkCategory(businessId, dto.categoryId);
    Object.assign(item, Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined)));
    return this.items.save(item);
  }

  async deleteItem(businessId: string, id: string) {
    // old orders keep their own copy of the name and price, so the item can simply be removed
    await this.items.delete({ id, businessId });
    return { ok: true };
  }

  // ---- what a guest sees after scanning
  private async byToken(token: string) {
    const table = await this.tables.findOne({ where: { qrToken: token, active: true } });
    if (!table) throw new NotFoundException("This QR code is not valid any more. Please ask the staff.");
    const business = await this.businesses.findOneOrFail({ where: { id: table.businessId } });
    this.requireDining(business);
    return { table, business };
  }

  async tablePage(token: string) {
    const { table, business } = await this.byToken(token);
    const [menu, pay] = await Promise.all([this.menu(business.id, true), this.paymentSettings.findOne({ where: { businessId: business.id } })]);
    return {
      business: { id: business.id, slug: business.slug, name: business.name, currency: business.currency },
      table: { id: table.id, label: table.label },
      menu,
      payment: { methods: pay?.enabledMethods ?? ["CASH"] },
    };
  }

  private async uniqueCode(taken: (code: string) => Promise<boolean>): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const code = shortCode(5);
      if (!(await taken(code))) return code;
    }
    return shortCode(8);
  }

  async placeOrder(token: string, dto: PlaceOrderDto) {
    const { table, business } = await this.byToken(token);
    const ids = [...new Set(dto.items.map((l) => l.menuItemId))];
    const found = await this.items.find({ where: { id: In(ids), businessId: business.id } });
    const byId = new Map(found.map((i) => [i.id, i]));
    for (const l of dto.items) {
      const item = byId.get(l.menuItemId);
      if (!item) throw new BadRequestException("One of the items is not on this menu.");
      if (!item.available) throw new ConflictException(`Sorry, ${item.name} is not available right now.`);
    }
    // prices come from the menu, never from the guest's request
    const lines = dto.items.map((l) => ({ item: byId.get(l.menuItemId)!, quantity: l.quantity, note: l.note ?? null }));
    const totalMinor = lines.reduce((n, l) => n + l.item.priceMinor * l.quantity, 0);
    const order = this.orders.create({
      code: await this.uniqueCode((code) => this.orders.exists({ where: { code } })),
      businessId: business.id,
      tableId: table.id,
      guestName: dto.guestName?.trim() || null,
      notes: dto.notes ?? null,
      status: "PLACED",
      totalMinor,
      paidMinor: 0,
      paymentStatus: "UNPAID",
      items: lines.map((l) => this.orderItems.create({ menuItemId: l.item.id, name: l.item.name, priceMinor: l.item.priceMinor, quantity: l.quantity, note: l.note })),
    });
    const saved = await this.orders.save(order);
    return this.orderByCode(saved.code);
  }

  view(o: DiningOrder) {
    return {
      id: o.id,
      code: o.code,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalMinor: o.totalMinor,
      paidMinor: o.paidMinor,
      guestName: o.guestName,
      notes: o.notes,
      table: o.table ? { id: o.table.id, label: o.table.label } : undefined,
      items: (o.items ?? []).map((i) => ({ id: i.id, name: i.name, quantity: i.quantity, priceMinor: i.priceMinor, note: i.note })),
      createdAt: o.createdAt,
    };
  }

  async orderByCode(code: string) {
    const o = await this.orders.findOne({ where: { code: code.trim().toUpperCase() }, relations: { items: true, table: true } });
    if (!o) throw new NotFoundException("Order not found.");
    const payments = await this.payments.find({ where: { orderId: o.id }, order: { createdAt: "DESC" } });
    return { ...this.view(o), payments: payments.map((p) => ({ id: p.id, method: p.method, status: p.status, amountMinor: p.amountMinor })) };
  }

  // ---- staff: orders
  async listOrders(businessId: string, filter: "active" | "all") {
    const rows = await this.orders.find({ where: { businessId, ...(filter === "active" && { status: In(["PLACED", "PREPARING", "READY"]) }) }, relations: { items: true, table: true }, order: { createdAt: "ASC" }, take: 300 });
    return rows.map((o) => this.view(o));
  }

  async setOrderStatus(businessId: string, id: string, status: OrderStatus) {
    const o = await this.orders.findOne({ where: { id, businessId }, relations: { items: true, table: true } });
    if (!o) throw new NotFoundException("Order not found.");
    if (!NEXT_ORDER[o.status].includes(status)) throw new BadRequestException(`A ${o.status.toLowerCase()} order cannot become ${status.toLowerCase()}.`);
    o.status = status;
    await this.orders.save(o);
    return this.view(o);
  }

  // ---- table reservations
  /** Gives the guest the smallest free table that fits the party, or says there is none. */
  async reserve(business: Business, dto: ReserveTableDto) {
    this.requireDining(business);
    const duration = 90;
    const startAt = zonedToUtc(dto.date, dto.time, business.timezone);
    if (startAt < new Date()) throw new BadRequestException("Choose a time in the future.");
    const endAt = new Date(startAt.getTime() + duration * 60_000);
    const tables = (await this.tables.find({ where: { businessId: business.id, active: true } })).filter((t) => t.seats >= dto.partySize).sort((a, b) => a.seats - b.seats);
    // existing reservations that could overlap (they last at most `duration` minutes, so look a little before the start)
    const near = await this.reservations.find({ where: { businessId: business.id, status: In([...RESERVATION_HOLDS]), startAt: LessThan(endAt) } });
    const busy = new Set(near.filter((r) => new Date(r.startAt.getTime() + r.durationMinutes * 60_000) > startAt).map((r) => r.tableId));
    const table = tables.find((t) => !busy.has(t.id));
    if (!table) throw new ConflictException("Sorry, no table is free for that time and party size. Please try another time.");
    const r = await this.reservations.save(this.reservations.create({ code: await this.uniqueCode((code) => this.reservations.exists({ where: { code } })), businessId: business.id, tableId: table.id, guestName: dto.guestName.trim(), guestPhone: dto.guestPhone.trim(), partySize: dto.partySize, startAt, durationMinutes: duration, status: "CONFIRMED", notes: dto.notes ?? null }));
    return this.reservationView(r, table);
  }

  private reservationView(r: TableReservation, table?: DiningTable | null) {
    return { id: r.id, code: r.code, status: r.status, guestName: r.guestName, guestPhone: r.guestPhone, partySize: r.partySize, startAt: r.startAt, durationMinutes: r.durationMinutes, notes: r.notes, table: table ? { id: table.id, label: table.label } : null };
  }

  async listReservations(business: Business, date?: string) {
    const where: Record<string, unknown> = { businessId: business.id };
    if (date) where.startAt = MoreThan(zonedToUtc(date, "00:00", business.timezone));
    const rows = await this.reservations.find({ where, order: { startAt: "ASC" }, take: 300 });
    const dayEnd = date ? zonedToUtc(addDays(date, 1), "00:00", business.timezone) : null;
    const tables = new Map((await this.tables.find({ where: { businessId: business.id } })).map((t) => [t.id, t]));
    return rows.filter((r) => !dayEnd || r.startAt < dayEnd).map((r) => this.reservationView(r, r.tableId ? tables.get(r.tableId) : null));
  }

  async setReservationStatus(businessId: string, id: string, status: ReservationStatus) {
    const r = await this.reservations.findOne({ where: { id, businessId } });
    if (!r) throw new NotFoundException("Reservation not found.");
    r.status = status;
    await this.reservations.save(r);
    return this.reservationView(r);
  }
}
