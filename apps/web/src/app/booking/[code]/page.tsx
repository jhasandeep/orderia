"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { dateTimeIn, money } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { Booking, PaymentMethod, PublicBusiness, StartPaymentResult } from "@/lib/types";
import { PayPanel } from "@/components/PayPanel";
import { Badge, Button, Card, ErrorNote, Field, Input, Notice, Spinner } from "@/components/ui";

export default function BookingPage() {
  const { code } = useParams<{ code: string }>();
  const [phone, setPhone] = useState<string | null>(null);
  const [fresh, setFresh] = useState(false);
  const [askPhone, setAskPhone] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const fromUrl = p.get("phone") ?? sessionStorage.getItem(`phone:${code}`);
    setFresh(p.get("new") === "1");
    if (fromUrl) {
      sessionStorage.setItem(`phone:${code}`, fromUrl);
      setPhone(fromUrl);
    } else setPhone("");
  }, [code]);

  if (phone === null) return <Spinner />;
  if (!phone)
    return (
      <div className="mx-auto max-w-md px-4 py-12">
        <Card className="space-y-4 p-6">
          <h1 className="text-xl font-bold">Find your booking</h1>
          <p className="text-sm text-slate-600">Enter the phone number you booked with to see booking <strong>{code}</strong>.</p>
          <Field label="Phone number"><Input value={askPhone} onChange={(e) => setAskPhone(e.target.value)} inputMode="tel" /></Field>
          <Button className="w-full" disabled={askPhone.length < 7} onClick={() => { sessionStorage.setItem(`phone:${code}`, askPhone); setPhone(askPhone); }}>Find booking</Button>
        </Card>
      </div>
    );
  return <Details code={code} phone={phone} fresh={fresh} />;
}

function Details({ code, phone, fresh }: { code: string; phone: string; fresh: boolean }) {
  const { data: b, loading, error, reload } = useLoad(() => api.get<Booking>(`/public/bookings/${code}?phone=${encodeURIComponent(phone)}`), [code, phone], 8000);
  const slug = b?.business?.slug;
  const { data: page } = useLoad(() => (slug ? api.get<PublicBusiness>(`/public/businesses/${slug}`) : Promise.resolve(null)), [slug]);
  const cancel = useAction();

  if (loading && !b) return <Spinner />;
  if (error || !b)
    return (
      <div className="mx-auto max-w-md px-4 py-12 space-y-3">
        <ErrorNote>{error || "Booking not found."}</ErrorNote>
        <Link className="text-sm text-indigo-600" href="/">Back to home</Link>
      </div>
    );

  const tz = b.business?.timezone ?? "Asia/Kolkata";
  const isStay = b.service?.mode === "STAY";
  const due = b.totalMinor - b.paidMinor;
  const active = b.status === "PENDING" || b.status === "CONFIRMED";
  const methods = (page?.payment.methods ?? []) as PaymentMethod[];
  const start = (method: PaymentMethod) => api.post<StartPaymentResult>(`/public/bookings/${b.code}/payments`, { method, phone });

  return (
    <div className="mx-auto max-w-2xl space-y-5 px-4 py-10">
      {fresh && <Notice tone="success">Your booking is {b.status === "CONFIRMED" ? "confirmed" : "received"}! Keep your code: <strong>{b.code}</strong>.</Notice>}
      <Card className="p-6" data-testid="booking-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Booking code</p>
            <p className="font-mono text-3xl font-bold tracking-widest" data-testid="booking-code">{b.code}</p>
          </div>
          <div className="flex gap-2">
            <Badge status={b.status} />
            <Badge status={b.paymentStatus} />
          </div>
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Where</dt><dd className="font-medium">{b.business?.name}</dd>{b.business?.address && <dd className="text-slate-600">{b.business.address}</dd>}{b.business?.phone && <dd className="text-slate-600">{b.business.phone}</dd>}</div>
          <div><dt className="text-slate-500">{b.service?.name}</dt><dd className="font-medium">{isStay ? `${dateTimeIn(b.startAt, tz)} → ${dateTimeIn(b.endAt, tz)}` : dateTimeIn(b.startAt, tz)}</dd>{b.provider && <dd className="text-slate-600">with {b.provider.name}</dd>}{isStay && <dd className="text-slate-600">{b.quantity} room(s), {b.guests} guest(s)</dd>}</div>
          <div><dt className="text-slate-500">Name</dt><dd className="font-medium">{b.guestName}</dd><dd className="text-slate-600">{b.guestPhone}</dd></div>
          <div><dt className="text-slate-500">Total</dt><dd className="text-lg font-bold">{money(b.totalMinor)}</dd><dd className="text-slate-600">Paid {money(b.paidMinor)}</dd></div>
        </dl>
        {b.notes && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Notes: {b.notes}</p>}
      </Card>

      {active && due > 0 && methods.length > 0 && (
        <Card className="p-6">
          <PayPanel methods={methods} currency="INR" dueMinor={due} start={start} onChange={() => reload(true)} prefill={{ name: b.guestName, phone: b.guestPhone, email: b.guestEmail ?? undefined }} />
        </Card>
      )}
      {b.paymentStatus === "PAID" && <Notice tone="success">Paid in full. Thank you!</Notice>}

      {active && (
        <div className="space-y-2">
          <ErrorNote>{cancel.error}</ErrorNote>
          <Button variant="danger" disabled={cancel.busy} onClick={async () => { if (window.confirm("Cancel this booking?")) { await cancel.run(() => api.post(`/public/bookings/${b.code}/cancel`, { phone })); reload(true); } }}>Cancel booking</Button>
          {b.paidMinor > 0 && <p className="text-xs text-slate-500">You have paid {money(b.paidMinor)}. Please contact the business about a refund.</p>}
        </div>
      )}
      <Link href={`/b/${b.business?.slug}`} className="inline-block text-sm text-indigo-600">← Back to {b.business?.name}</Link>
    </div>
  );
}
