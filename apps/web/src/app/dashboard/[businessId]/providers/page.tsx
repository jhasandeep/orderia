"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz } from "@/lib/business";
import { WEEKDAYS, dayLabel } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Provider, Service } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Spinner, Textarea } from "@/components/ui";

interface TimeOff { id: string; date: string; reason: string | null }
type Rule = { weekday: number; startTime: string; endTime: string };

export default function Providers() {
  const { businessId, can } = useBiz();
  const manage = can("OWNER", "MANAGER");
  const list = useLoad(() => api.get<Provider[]>(`/businesses/${businessId}/providers`), [businessId]);
  const services = useLoad(() => api.get<Service[]>(`/businesses/${businessId}/services`), [businessId]);
  const [edit, setEdit] = useState<Provider | "new" | null>(null);
  const [schedule, setSchedule] = useState<Provider | null>(null);
  const slotServices = (services.data ?? []).filter((s) => s.mode === "SLOT");

  return (
    <div>
      <PageTitle title="Staff & availability">
        {manage && <Button onClick={() => setEdit("new")} data-testid="add-provider">+ Add staff</Button>}
      </PageTitle>
      {list.loading && !list.data ? <Spinner /> : !list.data?.length ? (
        <Empty title="No staff yet">Add the doctors, stylists or therapists customers can book, then set their weekly hours.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" data-testid="provider-list">
          {list.data.map((p) => (
            <Card key={p.id} className={`p-4 ${p.active === false ? "opacity-60" : ""}`}>
              <h3 className="font-semibold">{p.name}</h3>
              {p.title && <p className="text-sm text-slate-500">{p.title}</p>}
              <p className="mt-2 text-sm text-slate-600">{p.serviceIds.map((id) => slotServices.find((s) => s.id === id)?.name).filter(Boolean).join(", ") || "No services assigned"}</p>
              <p className="mt-1 text-xs text-slate-500">
                {p.availability?.length ? `${new Set(p.availability.map((a) => a.weekday)).size} working day(s) / week` : "No hours set — not bookable yet"}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {p.active === false && <Badge>Hidden</Badge>}
                {manage && <Button size="sm" variant="secondary" onClick={() => setSchedule(p)}>Hours & time off</Button>}
                {manage && <Button size="sm" variant="secondary" onClick={() => setEdit(p)}>Edit</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {edit && <ProviderForm provider={edit === "new" ? null : edit} services={slotServices} onClose={() => setEdit(null)} onDone={() => { setEdit(null); list.reload(true); }} />}
      {schedule && <Schedule provider={schedule} onClose={() => setSchedule(null)} onSaved={() => list.reload(true)} />}
    </div>
  );
}

function ProviderForm({ provider, services, onClose, onDone }: { provider: Provider | null; services: Service[]; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const [f, setF] = useState({ name: provider?.name ?? "", title: provider?.title ?? "", bio: provider?.bio ?? "", serviceIds: provider?.serviceIds ?? [], active: provider?.active !== false });
  const { busy, error, run } = useAction();
  const toggle = (id: string) => setF({ ...f, serviceIds: f.serviceIds.includes(id) ? f.serviceIds.filter((x) => x !== id) : [...f.serviceIds, id] });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: f.name, title: f.title || undefined, bio: f.bio || undefined, serviceIds: f.serviceIds, active: f.active };
    const r = await run(() => (provider ? api.patch(`/businesses/${businessId}/providers/${provider.id}`, body) : api.post(`/businesses/${businessId}/providers`, body)));
    if (r) onDone();
  };
  return (
    <Modal title={provider ? "Edit staff" : "Add staff"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" data-testid="provider-form">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Senior stylist" /></Field>
        <Field label="Services they perform">
          {services.length ? (
            <div className="space-y-1">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.serviceIds.includes(s.id)} onChange={() => toggle(s.id)} /> {s.name}</label>
              ))}
            </div>
          ) : <p className="text-sm text-slate-500">Add a time-slot service first.</p>}
        </Field>
        <Field label="About"><Textarea value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> Bookable by customers</label>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </form>
    </Modal>
  );
}

function Schedule({ provider, onClose, onSaved }: { provider: Provider; onClose: () => void; onSaved: () => void }) {
  const { businessId } = useBiz();
  const [rules, setRules] = useState<Rule[]>(provider.availability ?? []);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAction();
  const off = useLoad(() => api.get<TimeOff[]>(`/businesses/${businessId}/providers/${provider.id}/time-off`), [provider.id]);
  const [offDate, setOffDate] = useState("");
  const [offReason, setOffReason] = useState("");
  const offAction = useAction();

  const update = (i: number, patch: Partial<Rule>) => { setSaved(false); setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r))); };
  const save = async () => {
    const r = await run(() => api.put(`/businesses/${businessId}/providers/${provider.id}/availability`, { rules }));
    if (r) { setSaved(true); onSaved(); }
  };
  const applyWeekdays = () => { setSaved(false); setRules([1, 2, 3, 4, 5].map((weekday) => ({ weekday, startTime: "09:00", endTime: "17:00" }))); };

  return (
    <Modal title={`${provider.name} — weekly hours`} onClose={onClose}>
      <div className="space-y-4" data-testid="schedule">
        <p className="text-sm text-slate-500">Times are in the business time zone. Add several rows for a lunch break.</p>
        <div className="space-y-2">
          {rules.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2" data-testid="rule-row">
              <select className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={r.weekday} onChange={(e) => update(i, { weekday: Number(e.target.value) })}>
                {WEEKDAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
              </select>
              <input type="time" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={r.startTime} onChange={(e) => update(i, { startTime: e.target.value })} />
              <span className="text-slate-400">to</span>
              <input type="time" className="rounded-lg border border-slate-300 px-2 py-2 text-sm" value={r.endTime} onChange={(e) => update(i, { endTime: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => { setSaved(false); setRules(rules.filter((_, j) => j !== i)); }}>Remove</Button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" data-testid="add-rule" onClick={() => { setSaved(false); setRules([...rules, { weekday: 1, startTime: "09:00", endTime: "17:00" }]); }}>+ Add hours</Button>
          <Button size="sm" variant="ghost" onClick={applyWeekdays}>Mon–Fri 9–5</Button>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <Button className="w-full" onClick={save} disabled={busy} data-testid="save-hours">{busy ? "Saving…" : saved ? "Saved ✓" : "Save hours"}</Button>

        <hr className="border-slate-200" />
        <h4 className="font-semibold">Time off</h4>
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Date"><Input type="date" value={offDate} onChange={(e) => setOffDate(e.target.value)} /></Field>
          <Field label="Reason"><Input value={offReason} onChange={(e) => setOffReason(e.target.value)} placeholder="Optional" /></Field>
          <Button size="sm" disabled={!offDate || offAction.busy} onClick={async () => {
            const r = await offAction.run(() => api.post(`/businesses/${businessId}/providers/${provider.id}/time-off`, { date: offDate, reason: offReason || undefined }));
            if (r) { setOffDate(""); setOffReason(""); off.reload(true); }
          }}>Add</Button>
        </div>
        <ErrorNote>{offAction.error}</ErrorNote>
        <ul className="space-y-1 text-sm">
          {(off.data ?? []).map((t) => (
            <li key={t.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span>{dayLabel(t.date)}{t.reason ? ` — ${t.reason}` : ""}</span>
              <button className="text-red-600 hover:underline" onClick={async () => { await api.del(`/businesses/${businessId}/providers/${provider.id}/time-off/${t.id}`); off.reload(true); }}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
