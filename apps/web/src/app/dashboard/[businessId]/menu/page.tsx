"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { fromMinor, toMinor, useBiz } from "@/lib/business";
import { money } from "@/lib/format";
import { useAction, useLoad } from "@/lib/hooks";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, PageTitle, Select, Spinner, Textarea } from "@/components/ui";

interface MenuData { categories: MenuCategory[]; items: MenuItem[] }

export default function Menu() {
  const { businessId, can } = useBiz();
  const manage = can("OWNER", "MANAGER");
  const menu = useLoad(() => api.get<MenuData>(`/businesses/${businessId}/dining/menu`), [businessId]);
  const [item, setItem] = useState<MenuItem | "new" | null>(null);
  const [catName, setCatName] = useState("");
  const cat = useAction();

  const data = menu.data;
  const groups = data ? [...data.categories.map((c) => ({ c, items: data.items.filter((i) => i.categoryId === c.id) })), { c: null, items: data.items.filter((i) => !i.categoryId || !data.categories.some((c) => c.id === i.categoryId)) }] : [];

  const toggle = async (i: MenuItem) => { await api.patch(`/businesses/${businessId}/dining/items/${i.id}`, { available: !i.available }); menu.reload(true); };

  return (
    <div>
      <PageTitle title="Menu">{manage && <Button onClick={() => setItem("new")} data-testid="add-item">+ Add dish</Button>}</PageTitle>
      {manage && (
        <form className="mb-5 flex max-w-md gap-2" onSubmit={async (e) => {
          e.preventDefault();
          if (!catName.trim()) return;
          const r = await cat.run(() => api.post(`/businesses/${businessId}/dining/categories`, { name: catName, sort: data?.categories.length ?? 0 }));
          if (r) { setCatName(""); menu.reload(true); }
        }}>
          <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="New category, e.g. Starters" data-testid="category-name" />
          <Button type="submit" variant="secondary" disabled={cat.busy} data-testid="add-category">Add</Button>
        </form>
      )}
      <ErrorNote>{cat.error || menu.error}</ErrorNote>
      {menu.loading && !data ? <Spinner /> : !data?.items.length && !data?.categories.length ? (
        <Empty title="Your menu is empty">Add categories and dishes. Guests see them when they scan a table QR code.</Empty>
      ) : (
        <div className="space-y-6" data-testid="menu-list">
          {groups.filter((g) => g.c || g.items.length).map((g) => (
            <section key={g.c?.id ?? "none"}>
              <h3 className="mb-2 flex items-center gap-3 text-lg font-semibold">
                {g.c?.name ?? "Other"}
                {manage && g.c && <button className="text-xs font-normal text-red-600 hover:underline" onClick={async () => { if (confirm(`Delete category "${g.c!.name}"? Its dishes stay, uncategorised.`)) { await api.del(`/businesses/${businessId}/dining/categories/${g.c!.id}`); menu.reload(true); } }}>Delete</button>}
              </h3>
              {!g.items.length ? <p className="text-sm text-slate-400">No dishes yet.</p> : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {g.items.map((i) => (
                    <Card key={i.id} className={`p-3 ${i.available ? "" : "opacity-60"}`} data-testid="menu-item">
                      <div className="flex justify-between gap-2">
                        <div>
                          <p className="font-semibold"><span className={`mr-2 inline-block h-3 w-3 rounded-sm border-2 ${i.veg ? "border-green-600" : "border-red-600"}`} />{i.name}</p>
                          {i.description && <p className="text-sm text-slate-500">{i.description}</p>}
                        </div>
                        <span className="font-bold">{money(i.priceMinor)}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {!i.available && <Badge>Sold out</Badge>}
                        <Button size="sm" variant="secondary" onClick={() => toggle(i)}>{i.available ? "Mark sold out" : "Back in stock"}</Button>
                        {manage && <Button size="sm" variant="ghost" onClick={() => setItem(i)}>Edit</Button>}
                        {manage && <Button size="sm" variant="ghost" onClick={async () => { if (confirm(`Delete "${i.name}"?`)) { await api.del(`/businesses/${businessId}/dining/items/${i.id}`); menu.reload(true); } }}>Delete</Button>}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      {item && <ItemForm item={item === "new" ? null : item} categories={data?.categories ?? []} onClose={() => setItem(null)} onDone={() => { setItem(null); menu.reload(true); }} />}
    </div>
  );
}

function ItemForm({ item, categories, onClose, onDone }: { item: MenuItem | null; categories: MenuCategory[]; onClose: () => void; onDone: () => void }) {
  const { businessId } = useBiz();
  const [f, setF] = useState({ name: item?.name ?? "", description: item?.description ?? "", price: item ? fromMinor(item.priceMinor) : "", categoryId: item?.categoryId ?? "", veg: item?.veg ?? true });
  const { busy, error, run } = useAction();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { name: f.name, description: f.description || undefined, priceMinor: toMinor(f.price), categoryId: f.categoryId || undefined, veg: f.veg };
    const r = await run(() => (item ? api.patch(`/businesses/${businessId}/dining/items/${item.id}`, body) : api.post(`/businesses/${businessId}/dining/items`, body)));
    if (r) onDone();
  };
  return (
    <Modal title={item ? "Edit dish" : "Add dish"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" data-testid="item-form">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Price (₹)"><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} required /></Field>
          <Field label="Category">
            <Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Description"><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.veg} onChange={(e) => setF({ ...f, veg: e.target.checked })} /> Vegetarian</label>
        <ErrorNote>{error}</ErrorNote>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
      </form>
    </Modal>
  );
}
