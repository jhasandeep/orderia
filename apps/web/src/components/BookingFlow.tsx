"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { addDays, dayLabel, localDate, money, timeIn } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Booking, PublicBusiness, Service, Slot } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Notice, Spinner, Textarea } from "./ui";

const ANY = "any";

/** The booking wizard on a business page: choose a service, then a time (or dates for a hotel), then your details. */
export function BookingFlow({ page }: { page: PublicBusiness }) {
  const router = useRouter();
  const { user } = useAuth();
  const { business, services, providers, payment } = page;
  const tz = business.timezone;
  const today = useMemo(() => localDate(new Date(), tz), [tz]);

  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((s) => s.id === serviceId);
  const [providerId, setProviderId] = useState(ANY);
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [checkIn, setCheckIn] = useState(addDays(today, 1));
  const [checkOut, setCheckOut] = useState(addDays(today, 2));
  const [rooms, setRooms] = useState(1);
  const [guests, setGuests] = useState(2);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const { busy, error, run } = useAction();

  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name, phone: f.phone || user.phone || "", email: f.email || user.email }));
  }, [user]);
  useEffect(() => {
    setSlot(null);
    setProviderId(ANY);
  }, [serviceId]);
  useEffect(() => setSlot(null), [date, providerId]);

  const offering = providers.filter((p) => service && p.serviceIds.includes(service.id));

  const slots = useLoad(
    async () => {
      if (!service || service.mode !== "SLOT") return null;
      const q = new URLSearchParams({ serviceId: service.id, date });
      if (providerId !== ANY) q.set("providerId", providerId);
      return api.get<{ slots: Slot[] }>(`/public/businesses/${business.slug}/availability?${q}`);
    },
    [service?.id, date, providerId],
  );

  const quote = useLoad(
    async () => {
      if (!service || service.mode !== "STAY" || checkOut <= checkIn) return null;
      return api.get<{ nights: number; available: number; totalMinor: number; pricePerNightMinor: number }>(`/public/businesses/${business.slug}/rooms?serviceId=${service.id}&checkIn=${checkIn}&checkOut=${checkOut}`);
    },
    [service?.id, checkIn, checkOut],
  );

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => addDays(today, i)), [today]);

  if (services.length === 0) return <Notice>This business has not added anything to book yet. Please check back soon.</Notice>;

  const isStay = service?.mode === "STAY";
  const ready = isStay ? Boolean(quote.data && quote.data.available >= rooms) : Boolean(slot);
  const total = isStay ? (quote.data?.totalMinor ?? 0) * rooms : (service?.priceMinor ?? 0);
  const advance = payment.advancePercent > 0 ? Math.ceil((total * payment.advancePercent) / 100) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;
    const body = isStay
      ? { serviceId: service.id, checkIn, checkOut, rooms, guests, guestName: form.name, guestPhone: form.phone, guestEmail: form.email || undefined, notes: form.notes || undefined }
      : { serviceId: service.id, providerId: slot!.providerId, date: localDate(new Date(slot!.start), tz), time: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(slot!.start)), guestName: form.name, guestPhone: form.phone, guestEmail: form.email || undefined, notes: form.notes || undefined };
    const b = await run(() => api.post<Booking>(`/public/businesses/${business.slug}/bookings`, body));
    if (b) router.push(`/booking/${b.code}?phone=${encodeURIComponent(form.phone)}&new=1`);
  };

  return (
    <Card className="p-5 sm:p-6" data-testid="booking-flow">
      <h2 className="text-xl font-bold">{isStay ? "Book a room" : "Book an appointment"}</h2>

      <div className="mt-4 space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">1. Choose {isStay ? "a room type" : "a service"}</legend>
          <div className="grid gap-2">
            {services.map((s: Service) => (
              <label key={s.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition ${serviceId === s.id ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : "border-slate-200 hover:border-slate-300"}`}>
                <span className="flex items-center gap-3">
                  <input type="radio" name="service" checked={serviceId === s.id} onChange={() => setServiceId(s.id)} className="accent-indigo-600" />
                  <span>
                    <span className="block font-medium">{s.name}</span>
                    <span className="block text-xs text-slate-500">{s.mode === "SLOT" ? `${s.durationMinutes} min` : "per night"}{s.description ? ` · ${s.description}` : ""}</span>
                  </span>
                </span>
                <span className="font-semibold">{money(s.priceMinor, business.currency)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {service && !isStay && (
          <>
            {offering.length > 0 && (
              <Field label={`2. Who would you like to see?`}>
                <select value={providerId} onChange={(e) => setProviderId(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" aria-label="Provider">
                  <option value={ANY}>Anyone available</option>
                  {offering.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}{p.title ? `, ${p.title}` : ""}</option>
                  ))}
                </select>
              </Field>
            )}
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">3. Pick a day</div>
              <div className="flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Days">
                {days.map((d) => (
                  <button key={d} role="option" aria-selected={date === d} onClick={() => setDate(d)} className={`shrink-0 rounded-xl border px-3 py-2 text-center text-sm transition ${date === d ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
                    {dayLabel(d)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">4. Pick a time</div>
              {slots.loading ? (
                <Spinner label="Checking times…" />
              ) : slots.error ? (
                <ErrorNote>{slots.error}</ErrorNote>
              ) : !slots.data || slots.data.slots.length === 0 ? (
                <Notice tone="warn">No times are free on this day. Try another day{providerId !== ANY ? " or choose anyone available" : ""}.</Notice>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="slots">
                  {slots.data.slots.map((s) => (
                    <button key={s.start} onClick={() => setSlot(s)} aria-pressed={slot?.start === s.start} className={`rounded-lg border px-2 py-2 text-sm font-medium transition ${slot?.start === s.start ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white hover:border-indigo-300"}`}>
                      {timeIn(s.start, tz)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {service && isStay && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="2. Check-in"><Input type="date" min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (checkOut <= e.target.value) setCheckOut(addDays(e.target.value, 1)); }} /></Field>
              <Field label="Check-out"><Input type="date" min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
              <Field label="Rooms"><Input type="number" min={1} max={20} value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))} /></Field>
              <Field label="Guests"><Input type="number" min={1} max={50} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} /></Field>
            </div>
            {quote.loading ? <Spinner label="Checking rooms…" /> : quote.error ? <ErrorNote>{quote.error}</ErrorNote> : quote.data && (quote.data.available >= rooms ? <Notice tone="success">{quote.data.nights} night{quote.data.nights > 1 ? "s" : ""} × {rooms} room{rooms > 1 ? "s" : ""}: <strong>{money(total, business.currency)}</strong>. Check-in from {business.checkInTime}, check-out by {business.checkOutTime}.</Notice> : <Notice tone="warn">{quote.data.available === 0 ? "No rooms of this type are free on those dates." : `Only ${quote.data.available} room(s) are free on those dates.`}</Notice>)}
          </div>
        )}

        {ready && (
          <form onSubmit={submit} className="space-y-4 border-t border-slate-200 pt-5" data-testid="details-form">
            <div className="text-sm font-medium text-slate-700">{isStay ? "3" : "5"}. Your details</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} autoComplete="name" /></Field>
              <Field label="Phone" hint="We use it to find your booking."><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required inputMode="tel" minLength={7} autoComplete="tel" /></Field>
            </div>
            <Field label="Email (optional)"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" /></Field>
            <Field label="Notes (optional)"><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={isStay ? "Late arrival, extra bed, …" : "Anything we should know?"} /></Field>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
              <span>{service?.name}{!isStay && slot ? ` · ${timeIn(slot.start, tz)} with ${slot.providerName}` : ""}</span>
              <span className="font-bold">{money(total, business.currency)}</span>
            </div>
            {advance > 0 && <Notice>You will be asked for an advance of {money(advance, business.currency)} ({payment.advancePercent}%) after booking.</Notice>}
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" size="lg" className="w-full" disabled={busy} data-testid="confirm-booking">{busy ? "Booking…" : "Confirm booking"}</Button>
          </form>
        )}
      </div>
    </Card>
  );
}
