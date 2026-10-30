"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { addDays, dateTimeIn, localDate } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import type { PublicBusiness, Reservation } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Notice } from "./ui";

/** Reserve a table at a restaurant or hotel restaurant. */
export function ReserveTable({ page }: { page: PublicBusiness }) {
  const { business } = page;
  const today = localDate(new Date(), business.timezone);
  const [form, setForm] = useState({ guestName: "", guestPhone: "", partySize: 2, date: addDays(today, 1), time: "20:00", notes: "" });
  const [done, setDone] = useState<Reservation | null>(null);
  const { busy, error, run } = useAction();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await run(() => api.post<Reservation>(`/public/businesses/${business.slug}/table-reservations`, { ...form, notes: form.notes || undefined }));
    if (r) setDone(r);
  };

  if (done)
    return (
      <Card className="p-5" data-testid="reservation-done">
        <Notice tone="success">
          <strong>Table reserved!</strong> {done.table ? `Table ${done.table.label}` : "A table"} for {done.partySize} on {dateTimeIn(done.startAt, business.timezone)}. Your code is <strong>{done.code}</strong>.
        </Notice>
        <Button variant="secondary" className="mt-3" onClick={() => setDone(null)}>Make another reservation</Button>
      </Card>
    );

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-bold">Reserve a table</h2>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Name"><Input value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} required minLength={2} /></Field>
        <Field label="Phone"><Input value={form.guestPhone} onChange={(e) => setForm({ ...form, guestPhone: e.target.value })} required inputMode="tel" minLength={7} /></Field>
        <Field label="Date"><Input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required /></Field>
        <Field label="Time"><Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required /></Field>
        <Field label="Guests"><Input type="number" min={1} max={50} value={form.partySize} onChange={(e) => setForm({ ...form, partySize: Math.max(1, Number(e.target.value) || 1) })} /></Field>
        <Field label="Notes (optional)"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Birthday, high chair…" /></Field>
        <div className="space-y-3 sm:col-span-2">
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Reserving…" : "Reserve table"}</Button>
        </div>
      </form>
    </Card>
  );
}
