"use client";

import { useEffect, useState } from "react";
import { api, API_URL } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useBiz, useBusinessInfo, type BusinessInfo } from "@/lib/business";
import { useAction, useLoad } from "@/lib/hooks";
import type { ModuleName, PaymentMethod } from "@/lib/types";
import { Button, Card, ErrorNote, Field, Input, Notice, PageTitle, Spinner, Textarea } from "@/components/ui";

interface PaySettings {
  enabledMethods: PaymentMethod[];
  advancePercent: number;
  upiId: string | null;
  upiName: string | null;
  razorpay: { keyId: string | null; secretSet: boolean; webhookSecretSet: boolean };
}

export default function Settings() {
  const { businessId, can } = useBiz();
  const info = useBusinessInfo();
  return (
    <div className="space-y-8">
      <PageTitle title="Settings" />
      {!info.info ? <Spinner /> : <BusinessForm info={info.info} onSaved={() => info.reload(true)} />}
      {can("OWNER") ? <PaymentForm businessId={businessId} /> : <Notice>Only the owner can change payment settings.</Notice>}
    </div>
  );
}

function BusinessForm({ info, onSaved }: { info: BusinessInfo; onSaved: () => void }) {
  const { refresh } = useAuth();
  const [f, setF] = useState({
    name: info.name, description: info.description ?? "", phone: info.phone ?? "", address: info.address ?? "", city: info.city ?? "",
    timezone: info.timezone, slotIntervalMinutes: String(info.settings.slotIntervalMinutes), minNoticeMinutes: String(info.settings.minNoticeMinutes),
    autoConfirm: info.settings.autoConfirm, modules: info.modules as ModuleName[],
  });
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState(false);
  const toggle = (m: ModuleName) => setF({ ...f, modules: f.modules.includes(m) ? f.modules.filter((x) => x !== m) : [...f.modules, m] });

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-semibold">Business</h3>
      <form className="grid gap-4 sm:grid-cols-2" data-testid="business-form" onSubmit={async (e) => {
        e.preventDefault();
        setSaved(false);
        const r = await run(() => api.patch(`/businesses/${info.id}`, {
          name: f.name, description: f.description, phone: f.phone, address: f.address, city: f.city, timezone: f.timezone,
          slotIntervalMinutes: Number(f.slotIntervalMinutes), minNoticeMinutes: Number(f.minNoticeMinutes), autoConfirm: f.autoConfirm, modules: f.modules,
        }));
        if (r) { setSaved(true); onSaved(); refresh(); }
      }}>
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
        <Field label="Phone"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
        <Field label="Time zone"><Input value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })} placeholder="Asia/Kolkata" /></Field>
        <div className="sm:col-span-2"><Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field></div>
        <div className="sm:col-span-2"><Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field></div>
        <Field label="Slot interval (minutes)" hint="How often start times are offered."><Input type="number" min={5} max={240} value={f.slotIntervalMinutes} onChange={(e) => setF({ ...f, slotIntervalMinutes: e.target.value })} /></Field>
        <Field label="Minimum notice (minutes)" hint="Customers can't book sooner than this."><Input type="number" min={0} value={f.minNoticeMinutes} onChange={(e) => setF({ ...f, minNoticeMinutes: e.target.value })} /></Field>
        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.autoConfirm} onChange={(e) => setF({ ...f, autoConfirm: e.target.checked })} /> Confirm bookings automatically (otherwise staff confirm each one)</label>
          <p className="pt-2 text-sm font-medium">Features</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.modules.includes("APPOINTMENTS")} onChange={() => toggle("APPOINTMENTS")} /> Appointments &amp; stays</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.modules.includes("DINING")} onChange={() => toggle("DINING")} /> Dining: QR table ordering, menu &amp; reservations</label>
        </div>
        <div className="sm:col-span-2">
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy || !f.modules.length}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save changes"}</Button>
        </div>
      </form>
    </Card>
  );
}

function PaymentForm({ businessId }: { businessId: string }) {
  const s = useLoad(() => api.get<PaySettings>(`/businesses/${businessId}/payment-settings`), [businessId]);
  const [f, setF] = useState({ methods: ["CASH"] as PaymentMethod[], advance: "0", upiId: "", upiName: "", keyId: "", keySecret: "", webhookSecret: "" });
  const { busy, error, run } = useAction();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!s.data) return;
    setF((p) => ({ ...p, methods: s.data!.enabledMethods, advance: String(s.data!.advancePercent), upiId: s.data!.upiId ?? "", upiName: s.data!.upiName ?? "", keyId: s.data!.razorpay.keyId ?? "" }));
  }, [s.data]);

  const has = (m: PaymentMethod) => f.methods.includes(m);
  const toggle = (m: PaymentMethod) => { setSaved(false); setF({ ...f, methods: has(m) ? f.methods.filter((x) => x !== m) : [...f.methods, m] }); };
  const webhookUrl = `${API_URL}/public/webhooks/razorpay/${businessId}`;

  return (
    <Card className="p-5">
      <h3 className="mb-1 font-semibold">Payments</h3>
      <p className="mb-4 text-sm text-slate-500">Choose how customers can pay. Money goes straight to your own account: UPI to your UPI id, Razorpay to your Razorpay account.</p>
      {!s.data ? <Spinner /> : (
        <form className="space-y-5" data-testid="payment-form" onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          const r = await run(() => api.put(`/businesses/${businessId}/payment-settings`, {
            enabledMethods: f.methods, advancePercent: Number(f.advance), upiId: f.upiId, upiName: f.upiName, razorpayKeyId: f.keyId,
            ...(f.keySecret && { razorpayKeySecret: f.keySecret }), ...(f.webhookSecret && { razorpayWebhookSecret: f.webhookSecret }),
          }));
          if (r) { setSaved(true); setF((p) => ({ ...p, keySecret: "", webhookSecret: "" })); s.reload(true); }
        }}>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={has("CASH")} onChange={() => toggle("CASH")} /> Cash / pay at venue</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={has("UPI_QR")} onChange={() => toggle("UPI_QR")} data-testid="m-upi" /> UPI QR (direct to your UPI id)</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={has("RAZORPAY")} onChange={() => toggle("RAZORPAY")} data-testid="m-razorpay" /> Razorpay (cards, UPI, netbanking)</label>
          </div>
          {has("UPI_QR") && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="UPI id"><Input value={f.upiId} onChange={(e) => setF({ ...f, upiId: e.target.value })} placeholder="yourshop@okbank" data-testid="upi-id" /></Field>
              <Field label="Name shown to payer"><Input value={f.upiName} onChange={(e) => setF({ ...f, upiName: e.target.value })} /></Field>
            </div>
          )}
          {has("RAZORPAY") && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Key id"><Input value={f.keyId} onChange={(e) => setF({ ...f, keyId: e.target.value })} placeholder="rzp_live_…" /></Field>
                <Field label="Key secret" hint={s.data.razorpay.secretSet ? "Saved. Leave empty to keep it." : undefined}><Input type="password" value={f.keySecret} onChange={(e) => setF({ ...f, keySecret: e.target.value })} autoComplete="off" /></Field>
                <Field label="Webhook secret" hint={s.data.razorpay.webhookSecretSet ? "Saved. Leave empty to keep it." : undefined}><Input type="password" value={f.webhookSecret} onChange={(e) => setF({ ...f, webhookSecret: e.target.value })} autoComplete="off" /></Field>
              </div>
              <Notice>In the Razorpay dashboard add a webhook for <b>payment.captured</b> pointing to <code className="break-all">{webhookUrl}</code> with the same secret. Secrets are stored encrypted and never shown again.</Notice>
            </div>
          )}
          <Field label="Advance for bookings (%)" hint="0 = pay later. Customers pay this share of a booking online."><Input type="number" min={0} max={100} value={f.advance} onChange={(e) => setF({ ...f, advance: e.target.value })} className="w-28" /></Field>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" disabled={busy || !f.methods.length} data-testid="save-payments">{busy ? "Saving…" : saved ? "Saved ✓" : "Save payment settings"}</Button>
        </form>
      )}
    </Card>
  );
}
