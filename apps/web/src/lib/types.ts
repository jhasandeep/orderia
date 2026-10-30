export type BusinessType = "HOTEL" | "SALON" | "PARLOUR" | "DOCTOR" | "RESTAURANT" | "OTHER";
export type ModuleName = "APPOINTMENTS" | "DINING";
export type Role = "OWNER" | "MANAGER" | "RECEPTION" | "PROVIDER" | "KITCHEN";
export type PaymentMethod = "CASH" | "UPI_QR" | "RAZORPAY";

export interface Membership {
  role: Role;
  business: { id: string; slug: string; name: string; type: BusinessType; modules: ModuleName[] };
}
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}
export interface BusinessCard {
  id: string;
  slug: string;
  name: string;
  type: BusinessType;
  city: string | null;
  description: string | null;
  modules: ModuleName[];
}
export interface Service {
  id: string;
  name: string;
  description: string | null;
  mode: "SLOT" | "STAY";
  durationMinutes: number;
  priceMinor: number;
  capacity: number;
  active?: boolean;
}
export interface Provider {
  id: string;
  name: string;
  title: string | null;
  bio?: string | null;
  serviceIds: string[];
  active?: boolean;
  userId?: string | null;
  availability?: { weekday: number; startTime: string; endTime: string }[];
}
export interface PublicBusiness {
  business: { id: string; slug: string; name: string; type: BusinessType; description: string | null; phone: string | null; address: string | null; city: string | null; timezone: string; currency: string; modules: ModuleName[]; checkInTime: string; checkOutTime: string };
  services: Service[];
  providers: Provider[];
  payment: { methods: PaymentMethod[]; advancePercent: number };
}
export interface Slot {
  start: string;
  end: string;
  providerId: string;
  providerName: string;
}
export interface Booking {
  id: string;
  code: string;
  businessId: string;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  startAt: string;
  endAt: string;
  quantity: number;
  guests: number;
  guestName: string;
  guestPhone: string;
  guestEmail: string | null;
  notes: string | null;
  totalMinor: number;
  paidMinor: number;
  service?: { id: string; name: string; mode: "SLOT" | "STAY"; durationMinutes: number; priceMinor: number };
  provider: { id: string; name: string; title: string | null } | null;
  business?: { id: string; slug: string; name: string; phone: string | null; address: string | null; timezone: string };
}
export interface Payment {
  id: string;
  method: PaymentMethod;
  status: "CREATED" | "PENDING_VERIFICATION" | "PAID" | "FAILED" | "REJECTED";
  amountMinor: number;
  reference: string | null;
  bookingId: string | null;
  orderId: string | null;
  createdAt: string;
  paidAt: string | null;
}
export interface StartPaymentResult {
  payment: Payment;
  instructions?: string;
  upi?: { link: string; qrDataUrl: string; payeeName: string; upiId: string; amountMinor: number };
  razorpay?: { keyId: string; orderId: string; amountMinor: number; currency: string; name: string; description: string };
}
export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  veg: boolean;
  available: boolean;
  categoryId: string | null;
}
export interface MenuCategory {
  id: string;
  name: string;
  sort: number;
}
export interface Order {
  id: string;
  code: string;
  status: "PLACED" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PARTIAL" | "PAID";
  totalMinor: number;
  paidMinor: number;
  guestName: string | null;
  notes: string | null;
  table?: { id: string; label: string };
  items: { id: string; name: string; quantity: number; priceMinor: number; note: string | null }[];
  createdAt: string;
  payments?: { id: string; method: PaymentMethod; status: string; amountMinor: number }[];
}
export interface Table {
  id: string;
  label: string;
  seats: number;
  qrToken: string;
  active: boolean;
}
export interface Reservation {
  id: string;
  code: string;
  status: "REQUESTED" | "CONFIRMED" | "SEATED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  guestName: string;
  guestPhone: string;
  partySize: number;
  startAt: string;
  durationMinutes: number;
  notes: string | null;
  table: { id: string; label: string } | null;
}
