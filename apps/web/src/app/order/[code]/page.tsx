"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { Order, PaymentMethod, StartPaymentResult } from "@/lib/types";
import { PayPanel } from "@/components/PayPanel";
import { Badge, Card, ErrorNote, Notice, Spinner } from "@/components/ui";

const STEPS = [
  { key: "PLACED", label: "Order sent", icon: "🧾" },
  { key: "PREPARING", label: "Being prepared", icon: "🍳" },
  { key: "READY", label: "Ready", icon: "🛎️" },
  { key: "SERVED", label: "Served", icon: "✅" },
] as const;

type OrderView = Order & { business: { name: string; currency: string; slug: string }; paymentMethods: PaymentMethod[] };

/** Live status of a table order, plus payment. Refreshes by itself every few seconds. */
export default function OrderPage() {
  const { code } = useParams<{ code: string }>();
  const { data: o, loading, error, reload } = useLoad(() => api.get<OrderView>(`/public/orders/${code}`), [code], 4000);

  if (loading && !o) return <Spinner />;
  if (error || !o) return <div className="mx-auto max-w-md px-4 py-16"><ErrorNote>{error || "Order not found."}</ErrorNote></div>;

  const cancelled = o.status === "CANCELLED";
  const step = STEPS.findIndex((s) => s.key === o.status);
  const due = o.totalMinor - o.paidMinor;
  const pending = o.payments?.some((p) => p.status === "PENDING_VERIFICATION");
  const start = (method: PaymentMethod) => api.post<StartPaymentResult>(`/public/orders/${o.code}/payments`, { method });

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-8">
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{o.business.name} · table {o.table?.label}</p>
            <p className="font-mono text-2xl font-bold tracking-widest" data-testid="order-code">{o.code}</p>
          </div>
          <div className="flex gap-2"><Badge status={o.status} /><Badge status={o.paymentStatus} /></div>
        </div>

        {cancelled ? (
          <div className="mt-4"><Notice tone="warn">This order was cancelled. Please ask the staff if you have questions.</Notice></div>
        ) : (
          <ol className="mt-5 grid grid-cols-4 gap-2 text-center" data-testid="order-steps">
            {STEPS.map((s, i) => (
              <li key={s.key} className={`rounded-xl p-2 text-xs ${i <= step ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-400"}`} aria-current={i === step ? "step" : undefined}>
                <div className="text-xl">{s.icon}</div>
                {s.label}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 font-semibold">Your order</h2>
        <ul className="divide-y divide-slate-100 text-sm">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between py-2"><span>{i.quantity} × {i.name}{i.note && <span className="block text-xs text-slate-500">{i.note}</span>}</span><span>{money(i.quantity * i.priceMinor, o.business.currency)}</span></li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-slate-200 pt-3 font-bold"><span>Total</span><span>{money(o.totalMinor, o.business.currency)}</span></div>
      </Card>

      {!cancelled && due > 0 && !pending && (
        <Card className="p-5"><PayPanel methods={o.paymentMethods} currency={o.business.currency} dueMinor={due} start={start} onChange={() => reload(true)} prefill={{ name: o.guestName ?? undefined }} /></Card>
      )}
      {pending && <Notice>Your payment is waiting to be verified by the staff. This page updates by itself.</Notice>}
      {o.paymentStatus === "PAID" && <Notice tone="success">Paid. Thank you! 🎉</Notice>}
      <Link href={`/b/${o.business.slug}`} className="inline-block text-sm text-indigo-600">About {o.business.name}</Link>
    </div>
  );
}
