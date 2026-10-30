"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz, useBusinessInfo } from "@/lib/business";
import { addDays, dateTimeIn, dayLabel, localDate, pretty } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Reservation } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Spinner } from "@/components/ui";

export default function Reservations() {
  const { businessId } = useBiz();
  const { tz } = useBusinessInfo();
  const today = localDate(new Date(), tz);
  const [date, setDate] = useState("");
  const day = date || today;
  const list = useLoad(() => api.get<Reservation[]>(`/businesses/${businessId}/dining/reservations?date=${day}`), [businessId, day], 15000);
  const [adding, setAdding] = useState(false);

  const set = async (r: Reservation, status: Reservation["status"]) => { await api.patch(`/businesses/${businessId}/dining/reservations/${r.id}/status`, { status }); list.reload(true); };
  const ACTIONS: Record<string, [Reservation["status"], string][]> = {
    REQUESTED: [["CONFIRMED", "Confirm"], ["CANCELLED", "Cancel"]],
    CONFIRMED: [["SEATED", "Seat"], ["NO_SHOW", "No-show"], ["CANCELLED", "Cancel"]],
    SEATED: [["COMPLETED", "Complete"]],
  };

  return (
    <div>
      <PageTitle title="Table reservations"><Button onClick={() => setAdding(true)} data-testid="add-reservation">+ Add reservation</Button></PageTitle>
      <div className="mb-4 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => setDate(addDays(day, -1))}>←</Button>
        <Input type="date" value={day} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <Button size="sm" variant="secondary" onClick={() => setDate(addDays(day, 1))}>→</Button>
        <span className="text-sm text-slate-500">{dayLabel(day)}</span>
      </div>
      <ErrorNote>{list.error}</ErrorNote>
      {list.loading && !list.data ? <Spinner /> : !list.data?.length ? <Empty title="No reservations">Nothing booked for this day.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="reservation-list">
          {list.data.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div><p className="font-semibold">{r.guestName} · {r.partySize} guests</p><p className="text-sm text-slate-500">{dateTimeIn(r.startAt, tz)} · {r.guestPhone}</p></div>
                <Badge status={r.status}>{pretty(r.status)}</Badge>
              </div>
              <p className="mt-1 text-sm">{r.table ? `Table ${r.table.label}` : "No table assigned"} · {r.code}</p>
              {r.notes && <p className="mt-1 text-sm text-slate-500">{r.notes}</p>}
              <div className="mt-3 flex flex-wrap gap-2">{(ACTIONS[r.status] ?? []).map(([s, label]) => <Button key={s} size="sm" variant={s === "CANCELLED" || s === "NO_SHOW" ? "ghost" : "secondary"} onClick={() => set(r, s)}>{label}</Button>)}</div>
            </Card>
          ))}
        </div>
      )}
      {adding && <NewReservation defaultDate={day} onClose={() => setAdding(false)} onDone={() => { setAdding(false); list.reload(true); }} />}
    </div>
  );
}

function NewReservation({ defaultDate, onClose, onDone }: { defaultDate: string; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const [f, setF] = useState({ guestName: "", guestPhone: "", partySize: "2", date: defaultDate, time: "19:30", notes: "" });
  const { busy, error, run } = useAction();
  return (
    <Modal title="Add reservation" onClose={onClose}>
      <form className="space-y-4" onSubmit={async (e) => {
        e.preventDefault();
        const r = await run(() => api.post(`/businesses/${businessId}/dining/reservations`, { ...f, partySize: Number(f.partySize), notes: f.notes || undefined }));
        if (r) onDone();
      }}>
        <Field label="Guest name"><Input value={f.guestName} onChange={(e) => setF({ ...f, guestName: e.target.value })} required minLength={2} /></Field>
        <Field label="Phone"><Input value={f.guestPhone} onChange={(e) => setF({ ...f, guestPhone: e.target.value })} required minLength={7} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Guests"><Input type="number" min={1} value={f.partySize} onChange={(e) => setF({ ...f, partySize: e.target.value })} required /></Field>
          <Field label="Date"><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} required /></Field>
          <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} required /></Field>
        </div>
        <Field label="Notes"><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Reserve"}</Button>
      </form>
    </Modal>
  );
}
