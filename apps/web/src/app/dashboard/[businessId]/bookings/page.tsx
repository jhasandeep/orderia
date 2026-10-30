"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useBiz, useBusinessInfo } from "@/lib/business";
import { addDays, dateTimeIn, localDate, money, timeIn } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Booking, Provider, Service, Slot } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Select, Spinner } from "@/components/ui";

type Range = "today" | "week" | "past" | "all";

export default function Bookings() {
  const { businessId, can } = useBiz();
  const { tz, info } = useBusinessInfo();
  const today = localDate(new Date(), tz);
  const [range, setRange] = useState<Range>("today");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<null | "new" | { pay: Booking }>(null);
  const act = useAction();

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (range === "today") {
      p.set("from", today);
      p.set("to", today);
    }
    if (range === "week") {
      p.set("from", today);
      p.set("to", addDays(today, 7));
    }
    if (range === "past") {
      p.set("from", addDays(today, -7));
      p.set("to", addDays(today, -1));
    }
    if (status) p.set("status", status);
    if (q.trim()) p.set("q", q.trim());
    return p.toString();
  }, [range, status, q, today]);

  const list = useLoad(() => api.get<Booking[]>(`/businesses/${businessId}/bookings?${query}`), [businessId, query], 15000);
  const setBookingStatus = async (b: Booking, next: string) => {
    await act.run(() => api.patch(`/businesses/${businessId}/bookings/${b.id}/status`, { status: next }));
    list.reload(true);
  };
  const manage = can("OWNER", "MANAGER", "RECEPTION");

  return (
    <div>
      <PageTitle title="Bookings">{manage && <Button onClick={() => setModal("new")} data-testid="new-booking">+ New booking</Button>}</PageTitle>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {([["today", "Today"], ["week", "Next 7 days"], ["past", "Last 7 days"], ["all", "All"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setRange(v)} aria-pressed={range === v} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${range === v ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700"}`}>{label}</button>
        ))}
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="!w-40" aria-label="Status">
          <option value="">Any status</option>
          {["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, code" className="!w-56" aria-label="Search bookings" />
      </div>
      <ErrorNote>{act.error}</ErrorNote>

      {list.loading && !list.data ? <Spinner /> : !list.data?.length ? (
        <Empty title="No bookings here">Try another range, or add one with “New booking”.</Empty>
      ) : (
        <div className="space-y-3" data-testid="booking-list">
          {list.data.map((b) => {
            const due = b.totalMinor - b.paidMinor;
            const live = b.status === "PENDING" || b.status === "CONFIRMED";
            return (
              <Card key={b.id} className="p-4" data-testid="booking-row">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{dateTimeIn(b.startAt, tz)}{b.service?.mode === "STAY" && <span className="font-normal text-slate-500"> → {dateTimeIn(b.endAt, tz)}</span>}</p>
                    <p className="text-sm text-slate-700">{b.guestName} · <a className="text-indigo-600" href={`tel:${b.guestPhone}`}>{b.guestPhone}</a></p>
                    <p className="text-sm text-slate-500">{b.service?.name}{b.provider ? ` · ${b.provider.name}` : ""}{b.service?.mode === "STAY" ? ` · ${b.quantity} room(s)` : ""} · <span className="font-mono">{b.code}</span></p>
                    {b.notes && <p className="mt-1 text-xs text-slate-500">“{b.notes}”</p>}
                  </div>
                  <div className="text-right">
                    <div className="flex justify-end gap-2"><Badge status={b.status} /><Badge status={b.paymentStatus} /></div>
                    <p className="mt-1 text-sm font-medium">{money(b.totalMinor)}{due > 0 && b.paidMinor > 0 && <span className="text-slate-500"> (due {money(due)})</span>}</p>
                  </div>
                </div>
                {live && (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                    {b.status === "PENDING" && <Button size="sm" variant="success" onClick={() => setBookingStatus(b, "CONFIRMED")}>Confirm</Button>}
                    {b.status === "CONFIRMED" && <Button size="sm" onClick={() => setBookingStatus(b, "COMPLETED")}>Mark completed</Button>}
                    {b.status === "CONFIRMED" && <Button size="sm" variant="secondary" onClick={() => setBookingStatus(b, "NO_SHOW")}>No-show</Button>}
                    {manage && due > 0 && <Button size="sm" variant="secondary" onClick={() => setModal({ pay: b })}>Record payment</Button>}
                    <Button size="sm" variant="danger" onClick={() => window.confirm("Cancel this booking?") && setBookingStatus(b, "CANCELLED")}>Cancel</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {modal === "new" && info && <NewBooking tz={tz} slug={info.slug} onClose={() => setModal(null)} onDone={() => { setModal(null); list.reload(true); }} />}
      {modal && typeof modal === "object" && <RecordPayment booking={modal.pay} onClose={() => setModal(null)} onDone={() => { setModal(null); list.reload(true); }} />}
    </div>
  );
}

function RecordPayment({ booking, onClose, onDone }: { booking: Booking; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const due = booking.totalMinor - booking.paidMinor;
  const [method, setMethod] = useState("CASH");
  const [amount, setAmount] = useState(String(due / 100));
  const { busy, error, run } = useAction();
  return (
    <Modal title={`Record payment · ${booking.guestName}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">Total {money(booking.totalMinor)}, paid {money(booking.paidMinor)}, due <strong>{money(due)}</strong>.</p>
        <Field label="Received by"><Select value={method} onChange={(e) => setMethod(e.target.value)}><option value="CASH">Cash / card at counter</option><option value="UPI_QR">UPI to the business account</option></Select></Field>
        <Field label="Amount (₹)"><Input type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <ErrorNote>{error}</ErrorNote>
        <Button className="w-full" disabled={busy} onClick={async () => { const r = await run(() => api.post(`/businesses/${businessId}/payments`, { bookingId: booking.id, method, amountMinor: Math.round(Number(amount) * 100) })); if (r) onDone(); }}>Save payment</Button>
      </div>
    </Modal>
  );
}

/** A walk-in or phone booking taken by staff. */
function NewBooking({ tz, slug, onClose, onDone }: { tz: string; slug: string; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const catalog = useLoad(async () => {
    const [services, providers] = await Promise.all([api.get<Service[]>(`/businesses/${businessId}/services`), api.get<Provider[]>(`/businesses/${businessId}/providers`)]);
    return { services: services.filter((s) => s.active !== false), providers: providers.filter((p) => p.active !== false) };
  }, [businessId]);
  const today = localDate(new Date(), tz);
  const [serviceId, setServiceId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [date, setDate] = useState(today);
  const [slotStart, setSlotStart] = useState("");
  const [checkOut, setCheckOut] = useState(addDays(today, 1));
  const [rooms, setRooms] = useState(1);
  const [guest, setGuest] = useState({ name: "", phone: "" });
  const { busy, error, run } = useAction();

  const service = catalog.data?.services.find((s) => s.id === serviceId);
  useEffect(() => {
    if (!serviceId && catalog.data?.services[0]) setServiceId(catalog.data.services[0].id);
  }, [catalog.data, serviceId]);

  const slots = useLoad(async () => {
    if (!service || service.mode !== "SLOT") return [] as Slot[];
    const p = new URLSearchParams({ serviceId: service.id, date });
    if (providerId) p.set("providerId", providerId);
    return (await api.get<{ slots: Slot[] }>(`/public/businesses/${slug}/availability?${p}`)).slots;
  }, [service?.id, date, providerId]);
  const chosen = slots.data?.find((s) => s.start === slotStart);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;
    const body =
      service.mode === "STAY"
        ? { serviceId, checkIn: date, checkOut, rooms, guestName: guest.name, guestPhone: guest.phone }
        : { serviceId, providerId: chosen?.providerId, date, time: new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(slotStart)), guestName: guest.name, guestPhone: guest.phone };
    const r = await run(() => api.post(`/businesses/${businessId}/bookings`, body));
    if (r) onDone();
  };

  const offering = catalog.data?.providers.filter((p) => service && p.serviceIds.includes(service.id)) ?? [];

  return (
    <Modal title="New booking" onClose={onClose}>
      {catalog.loading ? <Spinner /> : !catalog.data?.services.length ? <p className="text-sm text-slate-600">Add a service first (Services page).</p> : (
        <form onSubmit={submit} className="space-y-4" data-testid="new-booking-form">
          <Field label="Service"><Select value={serviceId} onChange={(e) => { setServiceId(e.target.value); setSlotStart(""); }}>{catalog.data.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {money(s.priceMinor)}</option>)}</Select></Field>
          {service?.mode === "SLOT" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Who"><Select value={providerId} onChange={(e) => { setProviderId(e.target.value); setSlotStart(""); }}><option value="">Anyone available</option>{offering.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
                <Field label="Date"><Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSlotStart(""); }} /></Field>
              </div>
              <Field label="Time">
                {slots.loading ? <span className="text-sm text-slate-500">Checking…</span> : !slots.data?.length ? <span className="text-sm text-amber-700">No free times that day.</span> : (
                  <Select value={slotStart} onChange={(e) => setSlotStart(e.target.value)} data-testid="slot-select"><option value="">Choose a time</option>{slots.data.map((s) => <option key={s.start} value={s.start}>{timeIn(s.start, tz)} · {s.providerName}</option>)}</Select>
                )}
              </Field>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Check-in"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Check-out"><Input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></Field>
              <Field label="Rooms"><Input type="number" min={1} value={rooms} onChange={(e) => setRooms(Math.max(1, Number(e.target.value) || 1))} /></Field>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Customer name"><Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} required minLength={2} /></Field>
            <Field label="Phone"><Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} required minLength={7} inputMode="tel" /></Field>
          </div>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" className="w-full" disabled={busy || (service?.mode === "SLOT" && !slotStart)}>{busy ? "Saving…" : "Create booking"}</Button>
        </form>
      )}
    </Modal>
  );
}
