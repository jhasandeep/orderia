"use client";

import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { money } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { MenuCategory, MenuItem, Order, PaymentMethod } from "@/lib/types";
import { Button, ErrorNote, Input, Modal, Spinner, Textarea } from "@/components/ui";

interface TablePage {
  business: { id: string; slug: string; name: string; currency: string };
  table: { id: string; label: string };
  menu: { categories: MenuCategory[]; items: MenuItem[] };
  payment: { methods: PaymentMethod[] };
}

/** What a guest sees after scanning the QR code on a table. */
export default function TableMenu() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const { data, loading, error } = useLoad(() => api.get<TablePage>(`/public/tables/${token}`), [token]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const [guest, setGuest] = useState({ name: "", notes: "" });
  const [veg, setVeg] = useState(false);
  const { busy, error: orderError, run } = useAction();

  const items = useMemo(() => (data?.menu.items ?? []).filter((i) => !veg || i.veg), [data, veg]);
  const groups = useMemo(() => {
    const cats = data?.menu.categories ?? [];
    const out = cats.map((c) => ({ id: c.id, name: c.name, items: items.filter((i) => i.categoryId === c.id) }));
    out.push({ id: "other", name: cats.length ? "More" : "Menu", items: items.filter((i) => !i.categoryId || !cats.some((c) => c.id === i.categoryId)) });
    return out.filter((g) => g.items.length > 0);
  }, [data, items]);

  if (loading) return <Spinner label="Opening the menu…" />;
  if (error || !data) return <div className="mx-auto max-w-md px-4 py-16 text-center"><ErrorNote>{error || "This QR code is not valid."}</ErrorNote></div>;

  const cur = data.business.currency;
  const lines = (data.menu.items ?? []).filter((i) => cart[i.id] > 0);
  const count = lines.reduce((n, i) => n + cart[i.id], 0);
  const total = lines.reduce((n, i) => n + cart[i.id] * i.priceMinor, 0);
  const change = (id: string, d: number) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) + d) }));

  const place = async () => {
    const order = await run(() => api.post<Order>(`/public/tables/${token}/orders`, { guestName: guest.name || undefined, notes: guest.notes || undefined, items: lines.map((i) => ({ menuItemId: i.id, quantity: cart[i.id], note: notes[i.id] || undefined })) }));
    if (order) router.push(`/order/${order.code}`);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-32 pt-6">
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 p-5 text-white">
        <p className="text-sm opacity-90">Welcome to</p>
        <h1 className="text-2xl font-extrabold" data-testid="restaurant-name">{data.business.name}</h1>
        <p className="mt-1 text-sm">You are at <strong data-testid="table-label">table {data.table.label}</strong>. Order here and we will bring it to you.</p>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={veg} onChange={(e) => setVeg(e.target.checked)} className="accent-emerald-600" /> Vegetarian only
      </label>

      {groups.map((g) => (
        <section key={g.id} className="mt-6">
          <h2 className="mb-2 text-lg font-bold">{g.name}</h2>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {g.items.map((i) => (
              <div key={i.id} className="flex items-start justify-between gap-3 p-4" data-testid="menu-item">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className={`inline-block h-3.5 w-3.5 rounded-sm border-2 ${i.veg ? "border-emerald-600" : "border-red-600"}`} aria-label={i.veg ? "Vegetarian" : "Non-vegetarian"}><span className={`m-[1px] block h-1.5 w-1.5 rounded-full ${i.veg ? "bg-emerald-600" : "bg-red-600"}`} /></span>
                    {i.name}
                  </p>
                  {i.description && <p className="mt-0.5 text-sm text-slate-500">{i.description}</p>}
                  <p className="mt-1 text-sm font-semibold">{money(i.priceMinor, cur)}</p>
                </div>
                {cart[i.id] > 0 ? (
                  <div className="flex shrink-0 items-center gap-1 rounded-lg border border-indigo-600 text-indigo-700">
                    <button aria-label={`Remove one ${i.name}`} className="px-3 py-1.5 text-lg" onClick={() => change(i.id, -1)}>−</button>
                    <span className="w-6 text-center font-semibold" data-testid="qty">{cart[i.id]}</span>
                    <button aria-label={`Add one more ${i.name}`} className="px-3 py-1.5 text-lg" onClick={() => change(i.id, 1)}>+</button>
                  </div>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => change(i.id, 1)} aria-label={`Add ${i.name}`}>Add</Button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
      {groups.length === 0 && <p className="mt-10 text-center text-slate-500">Nothing is available right now. Please ask the staff.</p>}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-4 shadow-lg">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <div><p className="text-sm text-slate-500">{count} item{count > 1 ? "s" : ""}</p><p className="text-lg font-bold" data-testid="cart-total">{money(total, cur)}</p></div>
            <Button size="lg" onClick={() => setOpen(true)} data-testid="review-order">Review order</Button>
          </div>
        </div>
      )}

      {open && (
        <Modal title="Your order" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            {lines.map((i) => (
              <div key={i.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm"><span>{cart[i.id]} × {i.name}</span><span className="font-medium">{money(cart[i.id] * i.priceMinor, cur)}</span></div>
                <Input value={notes[i.id] ?? ""} onChange={(e) => setNotes({ ...notes, [i.id]: e.target.value })} placeholder="Note (less spicy, no onion…)" className="h-8 text-xs" aria-label={`Note for ${i.name}`} />
              </div>
            ))}
            <div className="flex justify-between border-t border-slate-200 pt-3 text-lg font-bold"><span>Total</span><span>{money(total, cur)}</span></div>
            <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} placeholder="Your name (optional)" aria-label="Your name" />
            <Textarea value={guest.notes} onChange={(e) => setGuest({ ...guest, notes: e.target.value })} placeholder="Anything else for the kitchen?" aria-label="Order notes" />
            <ErrorNote>{orderError}</ErrorNote>
            <Button size="lg" className="w-full" disabled={busy} onClick={place} data-testid="place-order">{busy ? "Sending…" : `Place order · ${money(total, cur)}`}</Button>
            <p className="text-center text-xs text-slate-500">You can pay after ordering.</p>
          </div>
        </Modal>
      )}
    </div>
  );
}
