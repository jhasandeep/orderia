"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { TYPE_INFO } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { BusinessCard, BusinessType } from "@/lib/types";
import { BusinessGrid } from "@/components/BusinessGrid";
import { Button, Input, LinkButton, Spinner } from "@/components/ui";

const TYPES: BusinessType[] = ["SALON", "PARLOUR", "DOCTOR", "HOTEL", "RESTAURANT"];

const STEPS = [
  { n: "1", title: "Find a place", text: "Salons, parlours, clinics, hotels and restaurants, all in one place." },
  { n: "2", title: "Pick a time", text: "See free slots or rooms live and book in under a minute. No phone calls." },
  { n: "3", title: "Pay your way", text: "Pay by UPI QR, card or netbanking, or pay at the venue." },
];

export default function Home() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const { data, loading } = useLoad(() => api.get<BusinessCard[]>("/businesses"), []);

  return (
    <>
      <section className="bg-gradient-to-b from-indigo-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-14 text-center sm:py-20">
          <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Book anything, <span className="text-indigo-600">in minutes</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">Appointments for salons, parlours and doctors, hotel rooms, and restaurant tables you can order from by QR code.</p>
          <form
            className="mx-auto mt-8 flex max-w-xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/explore?q=${encodeURIComponent(q)}`);
            }}
          >
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search salons, clinics, hotels…" aria-label="Search" className="h-12 rounded-full px-5 text-base" />
            <Button className="h-12 rounded-full px-6" onClick={() => router.push(`/explore?q=${encodeURIComponent(q)}`)}>Search</Button>
          </form>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {TYPES.map((t) => (
              <Link key={t} href={`/explore?type=${t}`} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:border-indigo-300 hover:shadow">
                <span className="text-lg">{TYPE_INFO[t].emoji}</span>
                {TYPE_INFO[t].plural}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="mb-6 text-2xl font-bold">Popular near you</h2>
        {loading ? <Spinner /> : <BusinessGrid businesses={(data ?? []).slice(0, 6)} />}
        {data && data.length > 6 && (
          <div className="mt-6 text-center">
            <LinkButton href="/explore" variant="secondary">See all {data.length}</LinkButton>
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-indigo-600 font-bold text-white">{s.n}</div>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Run a business? Get bookings and orders online.</h2>
          <p className="mt-2 max-w-2xl text-slate-300">One dashboard for appointments, hotel rooms, table reservations, QR menus and payments. Give each team member the right access: owner, manager, reception, doctor or stylist, kitchen.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/dashboard/new" size="lg">List your business</LinkButton>
            <LinkButton href="/login" variant="secondary" size="lg">Sign in to your dashboard</LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
