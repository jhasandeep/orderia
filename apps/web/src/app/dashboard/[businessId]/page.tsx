"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { useBiz, useBusinessInfo } from "@/lib/business";
import { dateTimeIn, money, timeIn } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { Badge, Button, Card, Empty, PageTitle, Spinner } from "@/components/ui";

interface Stats {
  date: string;
  bookingsToday: number;
  pendingBookings: number;
  completedToday: number;
  upcomingNextSevenDays: number;
  activeOrders: number;
  revenueTodayMinor: number;
  paymentsToVerify: number;
}

export default function Overview() {
  const { businessId, business, can } = useBiz();
  const { tz } = useBusinessInfo();
  const stats = useLoad(() => api.get<Stats>(`/businesses/${businessId}/stats`), [businessId], 15000);
  const appts = business?.modules.includes("APPOINTMENTS");
  const today = stats.data?.date;
  const bookings = useLoad(() => (appts && today ? api.get<Booking[]>(`/businesses/${businessId}/bookings?from=${today}&to=${today}`) : Promise.resolve([])), [businessId, today, appts]);
  const [copied, setCopied] = useState(false);
  if (!can("OWNER", "MANAGER", "RECEPTION")) return null;
  if (stats.loading && !stats.data) return <Spinner />;

  const s = stats.data;
  const link = typeof window !== "undefined" ? `${window.location.origin}/b/${business?.slug}` : "";
  const cards = [
    { label: "Bookings today", value: s?.bookingsToday ?? 0, show: appts, href: "/bookings" },
    { label: "Awaiting confirmation", value: s?.pendingBookings ?? 0, show: appts, href: "/bookings" },
    { label: "Next 7 days", value: s?.upcomingNextSevenDays ?? 0, show: appts, href: "/bookings" },
    { label: "Active orders", value: s?.activeOrders ?? 0, show: business?.modules.includes("DINING"), href: "/orders" },
    { label: "Collected today", value: money(s?.revenueTodayMinor ?? 0), show: true, href: "/payments" },
    { label: "Payments to verify", value: s?.paymentsToVerify ?? 0, show: true, href: "/payments", warn: (s?.paymentsToVerify ?? 0) > 0 },
  ].filter((c) => c.show);

  return (
    <div>
      <PageTitle title={`Welcome back`}>
        <Button variant="secondary" size="sm" onClick={() => { navigator.clipboard?.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied!" : "Copy booking link"}</Button>
      </PageTitle>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={`/dashboard/${businessId}${c.href}`}>
            <Card className={`p-4 transition hover:border-indigo-300 ${c.warn ? "border-amber-300 bg-amber-50" : ""}`}>
              <p className="text-sm text-slate-500">{c.label}</p>
              <p className="mt-1 text-2xl font-bold" data-testid={`stat-${c.label}`}>{c.value}</p>
            </Card>
          </Link>
        ))}
      </div>

      {appts && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Today&apos;s schedule</h2>
          {bookings.loading ? <Spinner /> : !bookings.data?.length ? (
            <Empty title="Nothing booked for today yet">Share your booking link so customers can book online.</Empty>
          ) : (
            <Card className="divide-y divide-slate-100">
              {bookings.data.filter((b) => b.status !== "CANCELLED").map((b) => (
                <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                  <div>
                    <p className="font-medium">{timeIn(b.startAt, tz)} · {b.guestName}</p>
                    <p className="text-slate-500">{b.service?.name}{b.provider ? ` · ${b.provider.name}` : ""} · {dateTimeIn(b.startAt, tz)}</p>
                  </div>
                  <div className="flex gap-2"><Badge status={b.status} /><Badge status={b.paymentStatus} /></div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
