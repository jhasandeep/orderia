"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { TYPE_INFO } from "@/lib/format";
import { useAction } from "@/lib/hooks";
import type { BusinessType, ModuleName } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Textarea } from "@/components/ui";

const TYPES: BusinessType[] = ["SALON", "PARLOUR", "DOCTOR", "HOTEL", "RESTAURANT", "OTHER"];
const DEFAULTS: Record<BusinessType, ModuleName[]> = { HOTEL: ["APPOINTMENTS", "DINING"], SALON: ["APPOINTMENTS"], PARLOUR: ["APPOINTMENTS"], DOCTOR: ["APPOINTMENTS"], RESTAURANT: ["DINING"], OTHER: ["APPOINTMENTS"] };

export default function NewBusiness() {
  const router = useRouter();
  const { refresh } = useAuth();
  const { busy, error, run } = useAction();
  const [type, setType] = useState<BusinessType>("SALON");
  const [modules, setModules] = useState<ModuleName[]>(DEFAULTS.SALON);
  const [form, setForm] = useState({ name: "", city: "", phone: "", address: "", description: "" });

  const pick = (t: BusinessType) => {
    setType(t);
    setModules(DEFAULTS[t]);
  };
  const toggle = (m: ModuleName) => setModules((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const b = await run(() => api.post<{ id: string }>("/businesses", { name: form.name, type, modules, city: form.city || undefined, phone: form.phone || undefined, address: form.address || undefined, description: form.description || undefined }));
    if (b) {
      await refresh();
      router.push(`/dashboard/${b.id}${modules.includes("APPOINTMENTS") ? "/services" : "/menu"}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold">List your business</h1>
      <p className="mt-1 text-slate-600">Tell us what you run. You can change everything later.</p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <div>
          <div className="mb-2 text-sm font-medium text-slate-700">What kind of business is it?</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPES.map((t) => (
              <button key={t} type="button" onClick={() => pick(t)} aria-pressed={type === t} data-testid={`type-${t}`} className={`rounded-xl border p-3 text-left transition ${type === t ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-600" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                <div className="text-2xl">{TYPE_INFO[t].emoji}</div>
                <div className="font-semibold">{TYPE_INFO[t].label}</div>
                <div className="text-xs text-slate-500">{TYPE_INFO[t].blurb}</div>
              </button>
            ))}
          </div>
        </div>
        <Card className="space-y-4 p-5">
          <Field label="Business name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} placeholder="Glow Salon" /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City"><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} inputMode="tel" /></Field>
          </div>
          <Field label="Address"><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="About"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="A line or two for your page" /></Field>
        </Card>
        <Card className="space-y-2 p-5">
          <div className="text-sm font-medium text-slate-700">What do you want to use?</div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={modules.includes("APPOINTMENTS")} onChange={() => toggle("APPOINTMENTS")} className="mt-1 accent-indigo-600" /><span><strong>Appointments & stays</strong><br /><span className="text-slate-500">Time slots with staff (salon, clinic) or rooms by the night (hotel).</span></span></label>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={modules.includes("DINING")} onChange={() => toggle("DINING")} className="mt-1 accent-indigo-600" /><span><strong>QR tables & orders</strong><br /><span className="text-slate-500">Menu, QR code on each table, kitchen board and table reservations.</span></span></label>
        </Card>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" size="lg" className="w-full" disabled={busy || modules.length === 0} data-testid="create-business">{busy ? "Creating…" : "Create my business"}</Button>
      </form>
    </div>
  );
}
