"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz } from "@/lib/business";
import { money, pretty, STATUS_STYLE } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { Order } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, PageTitle, Spinner } from "@/components/ui";

const COLUMNS: { status: Order["status"]; title: string; next?: Order["status"]; action?: string }[] = [
  { status: "PLACED", title: "New", next: "PREPARING", action: "Start preparing" },
  { status: "PREPARING", title: "Preparing", next: "READY", action: "Mark ready" },
  { status: "READY", title: "Ready to serve", next: "SERVED", action: "Mark served" },
];

const ago = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
};

export default function Orders() {
  const { businessId, can } = useBiz();
  const [filter, setFilter] = useState<"active" | "all">("active");
  const orders = useLoad(() => api.get<Order[]>(`/businesses/${businessId}/dining/orders?filter=${filter}`), [businessId, filter], 5000);
  const [error, setError] = useState("");
  const canPay = can("OWNER", "MANAGER", "RECEPTION");

  const move = async (o: Order, status: Order["status"]) => {
    setError("");
    try {
      await api.patch(`/businesses/${businessId}/dining/orders/${o.id}/status`, { status });
      orders.reload(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update the order.");
    }
  };

  const card = (o: Order, col?: (typeof COLUMNS)[number]) => (
    <Card key={o.id} className="p-3" data-testid="order-card" data-code={o.code}>
      <div className="flex items-center justify-between">
        <span className="font-bold">{o.table?.label ?? "Table"}</span>
        <span className="text-xs text-slate-500">{o.code} · {ago(o.createdAt)}</span>
      </div>
      <ul className="mt-2 space-y-1 text-sm">
        {o.items.map((i) => (
          <li key={i.id}><b>{i.quantity}×</b> {i.name}{i.note && <span className="text-slate-500"> — {i.note}</span>}</li>
        ))}
      </ul>
      {o.notes && <p className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-800">{o.notes}</p>}
      <div className="mt-2 flex items-center gap-2 text-xs">
        {canPay && <><span className="font-semibold">{money(o.totalMinor)}</span><Badge status={o.paymentStatus}>{pretty(o.paymentStatus)}</Badge></>}
        {!col && <Badge status={o.status}>{pretty(o.status)}</Badge>}
      </div>
      {col?.next && (
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => move(o, col.next!)} data-testid={`order-${col.next}`}>{col.action}</Button>
          <Button size="sm" variant="ghost" onClick={() => move(o, "CANCELLED")}>Cancel</Button>
        </div>
      )}
    </Card>
  );

  return (
    <div>
      <PageTitle title="Orders">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(["active", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1 ${filter === f ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>{f === "active" ? "Live board" : "History"}</button>
          ))}
        </div>
      </PageTitle>
      <ErrorNote>{error || orders.error}</ErrorNote>
      {orders.loading && !orders.data ? <Spinner /> : filter === "active" ? (
        <div className="grid gap-4 md:grid-cols-3" data-testid="kitchen-board">
          {COLUMNS.map((col) => {
            const list = (orders.data ?? []).filter((o) => o.status === col.status);
            return (
              <div key={col.status}>
                <h3 className={`mb-2 inline-block rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[col.status]}`}>{col.title} · {list.length}</h3>
                <div className="space-y-3">{list.length ? list.map((o) => card(o, col)) : <p className="text-sm text-slate-400">Nothing here.</p>}</div>
              </div>
            );
          })}
        </div>
      ) : !orders.data?.length ? <Empty title="No orders yet">Orders placed from table QR codes show up here.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{orders.data.slice().reverse().map((o) => card(o))}</div>
      )}
      <p className="mt-6 text-xs text-slate-400">Refreshes every 5 seconds.</p>
    </div>
  );
}
