"use client";

import { useEffect, useState } from "react";
import { api, errorText } from "@/lib/api";
import { money } from "@/lib/format";
import type { PaymentMethod, StartPaymentResult } from "@/lib/types";
import { Button, ErrorNote, Input, Notice } from "./ui";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
  }
}

const METHODS: Record<PaymentMethod, { title: string; text: string; icon: string }> = {
  UPI_QR: { title: "Pay by UPI QR", text: "Scan with any UPI app", icon: "📱" },
  RAZORPAY: { title: "Pay online", text: "UPI, cards and netbanking", icon: "💳" },
  CASH: { title: "Pay at the venue", text: "Cash or card on arrival", icon: "💵" },
};

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

interface Props {
  methods: PaymentMethod[];
  currency: string;
  dueMinor: number;
  start: (method: PaymentMethod) => Promise<StartPaymentResult>;
  /** Called after something changed (so the page can reload the booking or order). */
  onChange: () => void;
  prefill?: { name?: string; phone?: string; email?: string };
}

/** Lets a customer choose how to pay and walks them through it. Used for bookings and for table orders. */
export function PayPanel({ methods, currency, dueMinor, start, onChange, prefill }: Props) {
  const [result, setResult] = useState<StartPaymentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [utr, setUtr] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setResult(null);
    setSubmitted(false);
  }, [dueMinor]);

  const choose = async (method: PaymentMethod) => {
    setBusy(true);
    setError("");
    try {
      const r = await start(method);
      setResult(r);
      if (method === "RAZORPAY" && r.razorpay) await openCheckout(r);
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const openCheckout = async (r: StartPaymentResult) => {
    const rz = r.razorpay!;
    await loadRazorpay();
    const box = new window.Razorpay!({
      key: rz.keyId,
      order_id: rz.orderId,
      amount: rz.amountMinor,
      currency: rz.currency,
      name: rz.name,
      description: rz.description,
      prefill: { name: prefill?.name, contact: prefill?.phone, email: prefill?.email },
      theme: { color: "#4f46e5" },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        try {
          await api.post("/public/payments/razorpay/verify", resp);
          setResult(null);
          onChange();
        } catch (e) {
          setError(errorText(e));
        }
      },
    });
    box.open();
  };

  const sendUtr = async () => {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      await api.post(`/public/payments/${result.payment.id}/upi-reference`, { reference: utr.trim() });
      setSubmitted(true);
      onChange();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (dueMinor <= 0) return null;

  return (
    <div className="space-y-4" data-testid="pay-panel">
      <div>
        <h3 className="font-semibold">Pay {money(dueMinor, currency)}</h3>
        <p className="text-sm text-slate-500">Choose how you would like to pay.</p>
      </div>
      <ErrorNote>{error}</ErrorNote>

      {!result && (
        <div className="grid gap-2 sm:grid-cols-3">
          {methods.map((m) => (
            <button key={m} type="button" disabled={busy} onClick={() => choose(m)} data-testid={`pay-${m}`} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-60">
              <div className="text-xl">{METHODS[m].icon}</div>
              <div className="mt-1 text-sm font-semibold">{METHODS[m].title}</div>
              <div className="text-xs text-slate-500">{METHODS[m].text}</div>
            </button>
          ))}
        </div>
      )}

      {result?.payment.method === "CASH" && (
        <div className="space-y-2">
          <Notice tone="success">{result.instructions} Amount: {money(result.payment.amountMinor, currency)}.</Notice>
          <Button variant="ghost" size="sm" onClick={() => setResult(null)}>Choose another way</Button>
        </div>
      )}

      {result?.upi && (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="upi-box">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.upi.qrDataUrl} alt="UPI QR code" className="h-44 w-44 rounded-lg border border-slate-200 bg-white p-2" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold">{result.upi.payeeName}</p>
              <p className="text-slate-600">UPI id: <span className="font-mono">{result.upi.upiId}</span></p>
              <p className="text-lg font-bold">{money(result.upi.amountMinor, currency)}</p>
              <a href={result.upi.link} className="inline-block rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white sm:hidden">Open UPI app</a>
              <p className="text-xs text-slate-500">{result.instructions}</p>
            </div>
          </div>
          {submitted ? (
            <Notice tone="success">Thanks! The team will check the payment and confirm it shortly.</Notice>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="Transaction / UTR number" aria-label="UPI transaction number" />
              <Button onClick={sendUtr} disabled={busy || utr.trim().length < 8}>I have paid</Button>
            </div>
          )}
        </div>
      )}

      {result?.razorpay && (
        <div className="space-y-2">
          <Notice>The payment window opened. If you closed it, you can open it again.</Notice>
          <Button onClick={() => openCheckout(result).catch((e) => setError(errorText(e)))}>Open payment window</Button>
        </div>
      )}
    </div>
  );
}
