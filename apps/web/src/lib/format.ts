import type { BusinessType } from "./types";

/** 49900 → "₹499" (paise are shown only when there are any). */
export function money(minor: number, currency = "INR"): string {
  const major = minor / 100;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: major % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(major);
}

export const timeIn = (iso: string, tz: string) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
export const dateIn = (iso: string, tz: string) => new Intl.DateTimeFormat("en-IN", { timeZone: tz, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
export const dateTimeIn = (iso: string, tz: string) => `${dateIn(iso, tz)}, ${timeIn(iso, tz)}`;

/** "YYYY-MM-DD" of a date as seen in a time zone. */
export function localDate(d: Date, tz: string): string {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
export const dayLabel = (date: string) => new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00Z`));
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const TYPE_INFO: Record<BusinessType, { label: string; plural: string; emoji: string; color: string; blurb: string }> = {
  SALON: { label: "Salon", plural: "Salons", emoji: "💇", color: "bg-pink-100 text-pink-700", blurb: "Haircuts, colour and styling" },
  PARLOUR: { label: "Parlour", plural: "Parlours", emoji: "💅", color: "bg-fuchsia-100 text-fuchsia-700", blurb: "Facials, waxing and makeup" },
  DOCTOR: { label: "Doctor", plural: "Doctors & clinics", emoji: "🩺", color: "bg-sky-100 text-sky-700", blurb: "Book a consultation" },
  HOTEL: { label: "Hotel", plural: "Hotels", emoji: "🏨", color: "bg-amber-100 text-amber-700", blurb: "Rooms by the night" },
  RESTAURANT: { label: "Restaurant", plural: "Restaurants", emoji: "🍽️", color: "bg-orange-100 text-orange-700", blurb: "Reserve a table, order by QR" },
  OTHER: { label: "Business", plural: "Other", emoji: "🏪", color: "bg-slate-100 text-slate-700", blurb: "Appointments" },
};

export const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  CONFIRMED: "bg-emerald-100 text-emerald-800",
  COMPLETED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
  NO_SHOW: "bg-red-100 text-red-700",
  UNPAID: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-sky-100 text-sky-800",
  PAID: "bg-emerald-100 text-emerald-800",
  CREATED: "bg-slate-100 text-slate-700",
  PENDING_VERIFICATION: "bg-amber-100 text-amber-800",
  FAILED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  PLACED: "bg-sky-100 text-sky-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-emerald-100 text-emerald-800",
  SERVED: "bg-slate-200 text-slate-700",
  REQUESTED: "bg-amber-100 text-amber-800",
  SEATED: "bg-emerald-100 text-emerald-800",
};

export const pretty = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
