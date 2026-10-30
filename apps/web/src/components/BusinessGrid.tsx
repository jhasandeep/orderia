import Link from "next/link";
import { TYPE_INFO } from "@/lib/format";
import type { BusinessCard } from "@/lib/types";
import { Empty } from "./ui";

export function BusinessGrid({ businesses }: { businesses: BusinessCard[] }) {
  if (businesses.length === 0) return <Empty title="Nothing here yet">Try a different search, or list your own business.</Empty>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {businesses.map((b) => {
        const t = TYPE_INFO[b.type];
        return (
          <Link key={b.id} href={`/b/${b.slug}`} data-testid="business-card" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${t.color}`}>{t.emoji} {t.label}</span>
              {b.city && <span className="text-xs text-slate-500">📍 {b.city}</span>}
            </div>
            <h3 className="mt-3 text-lg font-semibold group-hover:text-indigo-700">{b.name}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-slate-600">{b.description ?? t.blurb}</p>
            <div className="mt-3 flex gap-2 text-xs text-slate-500">
              {b.modules.includes("APPOINTMENTS") && <span>{b.type === "HOTEL" ? "Rooms" : "Appointments"}</span>}
              {b.modules.includes("DINING") && <span>· QR ordering & tables</span>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
