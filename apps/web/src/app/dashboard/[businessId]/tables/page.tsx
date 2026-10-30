"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz } from "@/lib/business";
import { useAction, useLoad } from "@/lib/hooks";
import type { Table } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Spinner } from "@/components/ui";

interface Qr { table: { id: string; label: string; seats: number }; url: string; qrDataUrl: string }

export default function Tables() {
  const { businessId, business, can } = useBiz();
  const manage = can("OWNER", "MANAGER");
  const tables = useLoad(() => api.get<Table[]>(`/businesses/${businessId}/dining/tables`), [businessId]);
  const [label, setLabel] = useState("");
  const [seats, setSeats] = useState("4");
  const [qr, setQr] = useState<Qr | null>(null);
  const add = useAction();

  const showQr = async (t: Table) => setQr(await api.get<Qr>(`/businesses/${businessId}/dining/tables/${t.id}/qr`));

  return (
    <div>
      <PageTitle title="Tables & QR codes" />
      {manage && (
        <form className="mb-5 flex flex-wrap items-end gap-2" onSubmit={async (e) => {
          e.preventDefault();
          const r = await add.run(() => api.post(`/businesses/${businessId}/dining/tables`, { label, seats: Number(seats) }));
          if (r) { setLabel(""); tables.reload(true); }
        }}>
          <Field label="Table name"><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="T1" required data-testid="table-label" /></Field>
          <Field label="Seats"><Input type="number" min={1} max={50} value={seats} onChange={(e) => setSeats(e.target.value)} className="w-24" /></Field>
          <Button type="submit" disabled={add.busy} data-testid="add-table">+ Add table</Button>
        </form>
      )}
      <ErrorNote>{add.error || tables.error}</ErrorNote>
      {tables.loading && !tables.data ? <Spinner /> : !tables.data?.length ? (
        <Empty title="No tables yet">Add your tables, then print each one&apos;s QR code. Guests scan it to see the menu and order from their seat.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="table-list">
          {tables.data.map((t) => (
            <Card key={t.id} className={`p-4 ${t.active ? "" : "opacity-60"}`}>
              <div className="flex items-center justify-between"><h3 className="font-semibold">{t.label}</h3><span className="text-sm text-slate-500">{t.seats} seats</span></div>
              <div className="mt-3 flex flex-wrap gap-2">
                {!t.active && <Badge>Disabled</Badge>}
                {manage && <Button size="sm" onClick={() => showQr(t)} data-testid={`qr-${t.label}`}>QR code</Button>}
                {manage && <Button size="sm" variant="ghost" onClick={async () => { await api.patch(`/businesses/${businessId}/dining/tables/${t.id}`, { active: !t.active }); tables.reload(true); }}>{t.active ? "Disable" : "Enable"}</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}
      {qr && (
        <Modal title={`${qr.table.label} — QR code`} onClose={() => setQr(null)}>
          <div className="space-y-3 text-center" data-testid="qr-modal">
            <div className="print-area">
              <p className="text-lg font-bold">{business?.name}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qrDataUrl} alt={`QR code for ${qr.table.label}`} className="mx-auto h-64 w-64" />
              <p className="font-semibold">Table {qr.table.label}</p>
              <p className="text-sm text-slate-500">Scan to view the menu and order</p>
            </div>
            <p className="break-all text-xs text-slate-400">{qr.url}</p>
            <div className="no-print flex justify-center gap-2">
              <Button onClick={() => window.print()}>Print</Button>
              <Button variant="secondary" onClick={async () => {
                if (!confirm("Make the printed QR code stop working and create a new one?")) return;
                await api.post(`/businesses/${businessId}/dining/tables/${qr.table.id}/rotate-qr`);
                setQr(await api.get<Qr>(`/businesses/${businessId}/dining/tables/${qr.table.id}/qr`));
              }}>Replace code</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
