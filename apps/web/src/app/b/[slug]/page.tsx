"use client";

import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { TYPE_INFO, money } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { PublicBusiness } from "@/lib/types";
import { BookingFlow } from "@/components/BookingFlow";
import { ReserveTable } from "@/components/ReserveTable";
import { Card, ErrorNote, Spinner } from "@/components/ui";

export default function BusinessPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, loading, error } = useLoad(() => api.get<PublicBusiness>(`/public/businesses/${slug}`), [slug]);

  if (loading) return <Spinner />;
  if (error || !page) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><ErrorNote>{error || "Business not found."}</ErrorNote></div>;
  const { business, services, providers } = page;
  const t = TYPE_INFO[business.type];
  const takesBookings = business.modules.includes("APPOINTMENTS");
  const hasDining = business.modules.includes("DINING");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 p-6 text-white sm:p-10">
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{t.emoji} {t.label}</span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="business-name">{business.name}</h1>
        {business.description && <p className="mt-2 max-w-2xl text-indigo-100">{business.description}</p>}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-indigo-100">
          {business.address && <span>📍 {business.address}{business.city ? `, ${business.city}` : ""}</span>}
          {!business.address && business.city && <span>📍 {business.city}</span>}
          {business.phone && <span>📞 {business.phone}</span>}
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_420px]">
        <div className="space-y-8">
          {takesBookings && (
            <section>
              <h2 className="mb-3 text-xl font-bold">{business.type === "HOTEL" ? "Rooms" : "Services"}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-semibold">{s.name}</h3>
                      <span className="font-bold text-indigo-700">{money(s.priceMinor, business.currency)}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{s.mode === "SLOT" ? `${s.durationMinutes} minutes` : "per night"}</p>
                    {s.description && <p className="mt-2 text-sm text-slate-600">{s.description}</p>}
                  </Card>
                ))}
              </div>
            </section>
          )}

          {providers.length > 0 && (
            <section>
              <h2 className="mb-3 text-xl font-bold">{business.type === "DOCTOR" ? "Our doctors" : "Our team"}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {providers.map((p) => (
                  <Card key={p.id} className="flex items-center gap-3 p-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-indigo-100 text-lg font-bold text-indigo-700">{p.name[0]}</div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      {p.title && <div className="text-sm text-slate-500">{p.title}</div>}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {hasDining && (
            <section>
              <h2 className="mb-3 text-xl font-bold">Dining</h2>
              <Card className="p-5 text-sm text-slate-600">
                Eating here? Scan the QR code on your table to see the menu, order and pay from your phone. Want to come with a group? Reserve a table below.
              </Card>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          {takesBookings && <BookingFlow page={page} />}
          {hasDining && <ReserveTable page={page} />}
        </aside>
      </div>
    </div>
  );
}
