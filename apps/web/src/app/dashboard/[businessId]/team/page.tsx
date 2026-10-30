"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz } from "@/lib/business";
import { pretty } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Role } from "@/lib/types";
import { Badge, Button, Card, ErrorNote, Field, Input, Notice, PageTitle, Select, Spinner } from "@/components/ui";

interface Member { id: string; role: Role; user: { id: string; name: string; email: string; phone: string | null } }

const ROLE_HELP: Record<Role, string> = {
  OWNER: "Everything, including payment settings and team.",
  MANAGER: "Bookings, services, staff, menu, tables and payments. No payment settings.",
  RECEPTION: "Bookings, reservations and payments. Can walk-in book and record cash.",
  PROVIDER: "Sees their own appointments (doctor, stylist…).",
  KITCHEN: "Kitchen board only: moves orders along and marks dishes sold out.",
};

export default function Team() {
  const { businessId, can } = useBiz();
  const owner = can("OWNER");
  const team = useLoad(() => api.get<Member[]>(`/businesses/${businessId}/team`), [businessId]);
  const [f, setF] = useState({ name: "", email: "", password: "", role: "RECEPTION" as Exclude<Role, "OWNER"> });
  const add = useAction();
  const [done, setDone] = useState("");

  return (
    <div>
      <PageTitle title="Team & roles" />
      {team.loading && !team.data ? <Spinner /> : (
        <div className="space-y-2" data-testid="team-list">
          {(team.data ?? []).map((m) => (
            <Card key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div><p className="font-semibold">{m.user.name}</p><p className="text-sm text-slate-500">{m.user.email}</p></div>
              <div className="flex items-center gap-2">
                <Badge>{pretty(m.role)}</Badge>
                {owner && m.role !== "OWNER" && <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Remove ${m.user.name}?`)) { await api.del(`/businesses/${businessId}/team/${m.id}`); team.reload(true); } }}>Remove</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {owner ? (
        <Card className="mt-6 p-4">
          <h3 className="mb-1 font-semibold">Add a team member</h3>
          <p className="mb-4 text-sm text-slate-500">Existing Orderia accounts are added by email. For a new person, set a password and share it with them.</p>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            setDone("");
            const r = await add.run(() => api.post(`/businesses/${businessId}/team`, { name: f.name, email: f.email, role: f.role, password: f.password || undefined }));
            if (r) { setDone(`${f.name} was added as ${pretty(f.role)}.`); setF({ ...f, name: "", email: "", password: "" }); team.reload(true); }
          }} data-testid="team-form">
            <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
            <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
            <Field label="Password (new accounts only)"><Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} minLength={8} /></Field>
            <Field label="Role" hint={ROLE_HELP[f.role]}>
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Exclude<Role, "OWNER"> })}>
                {(["MANAGER", "RECEPTION", "PROVIDER", "KITCHEN"] as const).map((r) => <option key={r} value={r}>{pretty(r)}</option>)}
              </Select>
            </Field>
            <div className="sm:col-span-2"><ErrorNote>{add.error}</ErrorNote>{done && <Notice tone="success">{done}</Notice>}<Button type="submit" className="mt-2" disabled={add.busy}>{add.busy ? "Adding…" : "Add member"}</Button></div>
          </form>
        </Card>
      ) : <div className="mt-6"><Notice>Only the owner can add or remove team members.</Notice></div>}
      <h3 className="mb-2 mt-8 font-semibold">What each role can do</h3>
      <ul className="space-y-1 text-sm text-slate-600">{(Object.keys(ROLE_HELP) as Role[]).map((r) => <li key={r}><b>{pretty(r)}</b> — {ROLE_HELP[r]}</li>)}</ul>
    </div>
  );
}
