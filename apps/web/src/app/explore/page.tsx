"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { TYPE_INFO } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { BusinessCard, BusinessType } from "@/lib/types";
import { BusinessGrid } from "@/components/BusinessGrid";
import { Input, Spinner } from "@/components/ui";

const TYPES = Object.keys(TYPE_INFO).filter((t) => t !== "OTHER") as BusinessType[];

export default function Explore() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");

  // start from the link's query string (?type=SALON&q=glow)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setType(p.get("type") ?? "");
    setQ(p.get("q") ?? "");
    setCity(p.get("city") ?? "");
  }, []);

  const { data, loading, error } = useLoad(() => {
    const p = new URLSearchParams();
    if (type) p.set("type", type);
    if (q.trim()) p.set("q", q.trim());
    if (city.trim()) p.set("city", city.trim());
    return api.get<BusinessCard[]>(`/businesses?${p}`);
  }, [type, q, city]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold tracking-tight">Explore</h1>
      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_200px]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or service…" aria-label="Search" />
        <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {[{ v: "", label: "All" }, ...TYPES.map((t) => ({ v: t, label: `${TYPE_INFO[t].emoji} ${TYPE_INFO[t].plural}` }))].map((t) => (
          <button key={t.v} onClick={() => setType(t.v)} aria-pressed={type === t.v} className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${type === t.v ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-indigo-300"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-8">
        {loading && !data ? <Spinner /> : error ? <p className="text-red-600">{error}</p> : <BusinessGrid businesses={data ?? []} />}
      </div>
    </div>
  );
}
