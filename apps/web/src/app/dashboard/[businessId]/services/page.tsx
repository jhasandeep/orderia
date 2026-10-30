"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fromMinor, toMinor, useBiz } from "@/lib/business";
import { money } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Service } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Select, Spinner, Textarea } from "@/components/ui";

export default function Services() {
  const { businessId, business } = useBiz();
  const list = useLoad(() => api.get<Service[]>(`/businesses/${businessId}/services`), [businessId]);
  const [edit, setEdit] = useState<Service | "new" | null>(null);
  const isHotel = business?.type === "HOTEL";

  return (
    <div>
      <PageTitle title={isHotel ? "Rooms & services" : "Services"}><Button onClick={() => setEdit("new")} data-testid="add-service">+ Add {isHotel ? "room type" : "service"}</Button></PageTitle>
      {list.loading && !list.data ? <Spinner /> : !list.data?.length ? (
        <Empty title="Nothing here yet">Add what customers can book: a haircut, a consultation, a room type…</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="service-list">
          {list.data.map((s) => (
            <Card key={s.id} className={`p-4 ${s.active === false ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold">{s.name}</h3><p className="text-sm text-slate-500">{s.mode === "SLOT" ? `${s.durationMinutes} min` : `per night · ${s.capacity} room(s)`}</p></div>
                <span className="font-bold">{money(s.priceMinor)}</span>
              </div>
              {s.description && <p className="mt-2 text-sm text-slate-600">{s.description}</p>}
              <div className="mt-3 flex items-center gap-2">
                {s.active === false && <Badge>Hidden</Badge>}
                <Button size="sm" variant="secondary" onClick={() => setEdit(s)}>Edit</Button>
                <Button size="sm" variant="ghost" onClick={async () => { await api.patch(`/businesses/${businessId}/services/${s.id}`, { active: s.active === false }); list.reload(true); }}>{s.active === false ? "Show" : "Hide"}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      {edit && <ServiceForm service={edit === "new" ? null : edit} defaultStay={isHotel} onClose={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(true); }} />}
    </div>
  );
}

function ServiceForm({ service, defaultStay, onClose, onDone }: { service: Service | null; defaultStay: boolean; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const [f, setF] = useState({ name: service?.name ?? "", description: service?.description ?? "", mode: service?.mode ?? (defaultStay ? "STAY" : "SLOT"), duration: String(service?.durationMinutes ?? 30), price: service ? fromMinor(service.priceMinor) : "", capacity: String(service?.capacity ?? 1) });
  const { busy, error, run } = useAction();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: f.name, description: f.description || undefined, priceMinor: toMinor(f.price), ...(f.mode === "SLOT" ? { durationMinutes: Number(f.duration) } : { capacity: Number(f.capacity) }) };
    const r = await run(() => (service ? api.patch(`/businesses/${businessId}/services/${service.id}`, body) : api.post(`/businesses/${businessId}/services`, { ...body, mode: f.mode })));
    if (r) onDone();
  };
  return (
    <Modal title={service ? "Edit" : "Add"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" data-testid="service-form">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} placeholder="Haircut" /></Field>
        {!service && <Field label="Booked by"><Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value as "SLOT" | "STAY" })}><option value="SLOT">Time slot (appointment)</option><option value="STAY">Nights (hotel room)</option></Select></Field>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={f.mode === "STAY" ? "Price per night (₹)" : "Price (₹)"}><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></Field>
          {f.mode === "SLOT" ? <Field label="Duration (minutes)"><Input type="number" min={5} step={5} value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} required /></Field> : <Field label="Rooms of this type"><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} required /></Field>}
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </form>
    </Modal>
  );
}
