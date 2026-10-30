import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import { DATE_COL } from "../common/db";
import type { BookingStatus, BusinessType, ModuleName, OrderStatus, PaymentMethod, PaymentStatus, ReservationStatus, Role, ServiceMode } from "../common/enums";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) email: string;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "varchar", nullable: true }) phone: string | null;
  @Column({ type: "varchar" }) passwordHash: string;
  @Column({ type: "boolean", default: false }) isPlatformAdmin: boolean;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

export interface BusinessSettings {
  /** Minutes between the start times offered to customers. */
  slotIntervalMinutes: number;
  /** A customer cannot book a slot that starts sooner than this. */
  minNoticeMinutes: number;
  /** Confirm bookings straight away (otherwise staff confirm them). */
  autoConfirm: boolean;
  /** Hotels: local times of check-in and check-out. */
  checkInTime: string;
  checkOutTime: string;
}

@Entity("businesses")
export class Business {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) slug: string;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "varchar" }) type: BusinessType;
  @Column({ type: "text", nullable: true }) description: string | null;
  @Column({ type: "varchar", nullable: true }) phone: string | null;
  @Column({ type: "varchar", nullable: true }) address: string | null;
  @Column({ type: "varchar", nullable: true }) city: string | null;
  @Column({ type: "varchar", default: "Asia/Kolkata" }) timezone: string;
  @Column({ type: "varchar", default: "INR" }) currency: string;
  @Column({ type: "simple-json" }) modules: ModuleName[];
  @Column({ type: "simple-json" }) settings: BusinessSettings;
  @Column({ type: "boolean", default: true }) active: boolean;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("memberships")
@Unique(["userId", "businessId"])
export class Membership {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Column({ type: "varchar" }) userId: string;
  @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) role: Role;
  @ManyToOne(() => User, { onDelete: "CASCADE" }) @JoinColumn({ name: "userId" }) user: User;
  @ManyToOne(() => Business, { onDelete: "CASCADE" }) @JoinColumn({ name: "businessId" }) business: Business;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("services")
export class Service {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "text", nullable: true }) description: string | null;
  /** SLOT: a time slot with a provider (haircut, consultation). STAY: nights in a room (hotel). */
  @Column({ type: "varchar", default: "SLOT" }) mode: ServiceMode;
  @Column({ type: "integer", default: 30 }) durationMinutes: number;
  /** Price in the smallest currency unit (paise): per visit for SLOT, per night for STAY. */
  @Column({ type: "integer" }) priceMinor: number;
  /** STAY: how many rooms of this type the hotel has. */
  @Column({ type: "integer", default: 1 }) capacity: number;
  @Column({ type: "boolean", default: true }) active: boolean;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("providers")
export class Provider {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  /** The staff login of this provider (a doctor or stylist who signs in to see their own bookings). */
  @Column({ type: "varchar", nullable: true }) userId: string | null;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "varchar", nullable: true }) title: string | null;
  @Column({ type: "text", nullable: true }) bio: string | null;
  @Column({ type: "simple-json" }) serviceIds: string[];
  @Column({ type: "boolean", default: true }) active: boolean;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("availability_rules")
export class AvailabilityRule {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) providerId: string;
  /** 0 = Sunday … 6 = Saturday. */
  @Column({ type: "integer" }) weekday: number;
  @Column({ type: "varchar" }) startTime: string;
  @Column({ type: "varchar" }) endTime: string;
}

@Entity("time_off")
export class TimeOff {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) providerId: string;
  /** Local calendar date, "YYYY-MM-DD". */
  @Column({ type: "varchar" }) date: string;
  @Column({ type: "varchar", nullable: true }) reason: string | null;
}

@Entity("bookings")
export class Booking {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) code: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) serviceId: string;
  @Column({ type: "varchar", nullable: true }) providerId: string | null;
  @Column({ type: "varchar", nullable: true }) customerId: string | null;
  @Column({ type: "varchar" }) guestName: string;
  @Column({ type: "varchar" }) guestPhone: string;
  @Column({ type: "varchar", nullable: true }) guestEmail: string | null;
  @Column({ type: DATE_COL }) startAt: Date;
  @Column({ type: DATE_COL }) endAt: Date;
  /** STAY: number of rooms. */
  @Column({ type: "integer", default: 1 }) quantity: number;
  @Column({ type: "integer", default: 1 }) guests: number;
  @Column({ type: "varchar", default: "PENDING" }) status: BookingStatus;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @Column({ type: "integer" }) totalMinor: number;
  @Column({ type: "integer", default: 0 }) paidMinor: number;
  @Column({ type: "varchar", default: "UNPAID" }) paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  @ManyToOne(() => Service) @JoinColumn({ name: "serviceId" }) service: Service;
  @ManyToOne(() => Provider, { nullable: true }) @JoinColumn({ name: "providerId" }) provider: Provider | null;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("payment_settings")
export class PaymentSettings {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "simple-json" }) enabledMethods: PaymentMethod[];
  /** Direct UPI QR: the business's own UPI id (for example name@bank). */
  @Column({ type: "varchar", nullable: true }) upiId: string | null;
  @Column({ type: "varchar", nullable: true }) upiName: string | null;
  @Column({ type: "varchar", nullable: true }) razorpayKeyId: string | null;
  /** Encrypted with APP_SECRET. */
  @Column({ type: "text", nullable: true }) razorpayKeySecretEnc: string | null;
  @Column({ type: "text", nullable: true }) razorpayWebhookSecretEnc: string | null;
  /** 0 = take the full amount; for example 30 = ask for 30% in advance. */
  @Column({ type: "integer", default: 0 }) advancePercent: number;
}

@Entity("payments")
export class Payment {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Index() @Column({ type: "varchar", nullable: true }) bookingId: string | null;
  @Index() @Column({ type: "varchar", nullable: true }) orderId: string | null;
  @Column({ type: "varchar" }) method: PaymentMethod;
  @Column({ type: "integer" }) amountMinor: number;
  @Column({ type: "varchar", default: "INR" }) currency: string;
  @Column({ type: "varchar", default: "CREATED" }) status: PaymentStatus;
  /** Razorpay order id. */
  @Column({ type: "varchar", nullable: true }) externalId: string | null;
  @Column({ type: "varchar", nullable: true }) externalPaymentId: string | null;
  /** UPI transaction reference (UTR) the customer typed in. */
  @Column({ type: "varchar", nullable: true }) reference: string | null;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
  @Column({ type: DATE_COL, nullable: true }) paidAt: Date | null;
}

@Entity("dining_tables")
@Unique(["businessId", "label"])
export class DiningTable {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) label: string;
  @Column({ type: "integer", default: 2 }) seats: number;
  /** The secret in the QR code link: anyone who scans it can order for this table. */
  @Index({ unique: true }) @Column({ type: "varchar" }) qrToken: string;
  @Column({ type: "boolean", default: true }) active: boolean;
}

@Entity("menu_categories")
export class MenuCategory {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "integer", default: 0 }) sort: number;
}

@Entity("menu_items")
export class MenuItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar", nullable: true }) categoryId: string | null;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "text", nullable: true }) description: string | null;
  @Column({ type: "integer" }) priceMinor: number;
  @Column({ type: "boolean", default: true }) veg: boolean;
  @Column({ type: "boolean", default: true }) available: boolean;
}

@Entity("dining_orders")
export class DiningOrder {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) code: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar" }) tableId: string;
  @Column({ type: "varchar", nullable: true }) guestName: string | null;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @Column({ type: "varchar", default: "PLACED" }) status: OrderStatus;
  @Column({ type: "integer" }) totalMinor: number;
  @Column({ type: "integer", default: 0 }) paidMinor: number;
  @Column({ type: "varchar", default: "UNPAID" }) paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  @ManyToOne(() => DiningTable) @JoinColumn({ name: "tableId" }) table: DiningTable;
  @OneToMany(() => DiningOrderItem, (i) => i.order, { cascade: true }) items: DiningOrderItem[];
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

@Entity("dining_order_items")
export class DiningOrderItem {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index() @Column({ type: "varchar" }) orderId: string;
  @Column({ type: "varchar" }) menuItemId: string;
  @Column({ type: "varchar" }) name: string;
  @Column({ type: "integer" }) priceMinor: number;
  @Column({ type: "integer" }) quantity: number;
  @Column({ type: "varchar", nullable: true }) note: string | null;
  @ManyToOne(() => DiningOrder, (o) => o.items, { onDelete: "CASCADE" }) @JoinColumn({ name: "orderId" }) order: DiningOrder;
}

@Entity("table_reservations")
export class TableReservation {
  @PrimaryGeneratedColumn("uuid") id: string;
  @Index({ unique: true }) @Column({ type: "varchar" }) code: string;
  @Index() @Column({ type: "varchar" }) businessId: string;
  @Column({ type: "varchar", nullable: true }) tableId: string | null;
  @Column({ type: "varchar" }) guestName: string;
  @Column({ type: "varchar" }) guestPhone: string;
  @Column({ type: "integer" }) partySize: number;
  @Column({ type: DATE_COL }) startAt: Date;
  @Column({ type: "integer", default: 90 }) durationMinutes: number;
  @Column({ type: "varchar", default: "REQUESTED" }) status: ReservationStatus;
  @Column({ type: "text", nullable: true }) notes: string | null;
  @CreateDateColumn({ type: DATE_COL }) createdAt: Date;
}

export const ALL_ENTITIES = [User, Business, Membership, Service, Provider, AvailabilityRule, TimeOff, Booking, PaymentSettings, Payment, DiningTable, MenuCategory, MenuItem, DiningOrder, DiningOrderItem, TableReservation];
