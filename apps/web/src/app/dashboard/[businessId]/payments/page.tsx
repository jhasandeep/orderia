"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz, useBusinessInfo } from "@/lib/business";
import { dateTimeIn, money, pretty } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { Payment } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Notice, PageTitle, Spinner } from "@/components/ui";

export default function Payments() {
  const { businessId } = useBiz();
  const { tz } = useBusinessInfo();
  const [tab, setTab] = useState<"verify" | "all">("verify");
  const list = useLoad(() => api.get<Payment[]>(`/businesses/${businessId}/payments${tab === "verify" ? "?status=PENDING_VERIFICATION" : ""}`), [businessId, tab], 8000);
  const [error, setError] = useState("");

  const act = async (p: Payment, what: "confirm" | "reject") => {
    setError("");
    try {
      await api.post(`/businesses/${businessId}/payments/${p.id}/${what}`);
      list.reload(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    }
  };

  return (
    <div>
      <PageTitle title="Payments">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button onClick={() => setTab("verify")} className={`rounded-md px-3 py-1 ${tab === "verify" ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`} data-testid="tab-verify">To verify</button>
          <button onClick={() => setTab("all")} className={`rounded-md px-3 py-1 ${tab === "all" ? "bg-white font-semibold shadow-sm" : "text-slate-600"}`}>All payments</button>
        </div>
      </PageTitle>
      {tab === "verify" && <Notice>Guests who paid by UPI QR enter their transaction (UTR) number. Match it with your bank or UPI app, then confirm.</Notice>}
      <ErrorNote>{error || list.error}</ErrorNote>
      <div className="mt-4">
        {list.loading && !list.data ? <Spinner /> : !list.data?.length ? <Empty title={tab === "verify" ? "Nothing to verify" : "No payments yet"} /> : (
          <div className="space-y-2" data-testid="payment-list">
            {list.data.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-3" data-testid="payment-row">
                <div>
                  <p className="font-semibold">{money(p.amountMinor)} <span className="font-normal text-slate-500">· {pretty(p.method)} · {p.bookingId ? "Booking" : "Order"}</span></p>
                  <p className="text-xs text-slate-500">{dateTimeIn(p.createdAt, tz)}{p.reference ? ` · Ref ${p.reference}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge status={p.status}>{pretty(p.status)}</Badge>
                  {p.status === "PENDING_VERIFICATION" && (
                    <>
                      <Button size="sm" onClick={() => act(p, "confirm")} data-testid="confirm-payment">Confirm received</Button>
                      <Button size="sm" variant="ghost" onClick={() => act(p, "reject")}>Reject</Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
