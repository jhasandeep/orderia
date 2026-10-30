"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateTimeIn, money } from "@/lib/format";
import { useLoad } from "@/lib/hooks";
import type { Booking } from "@/lib/types";
import { Badge, Card, Empty, LinkButton, PageTitle, Spinner } from "@/components/ui";

export default function MyBookings() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { data, loading } = useLoad(() => (user ? api.get<Booking[]>("/me/bookings") : Promise.resolve([])), [user?.id]);

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/me");
  }, [ready, user, router]);

  if (!ready || loading) return <Spinner />;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageTitle title="My bookings" />
      {!data || data.length === 0 ? (
        <Empty title="No bookings yet"><LinkButton href="/explore" className="mt-3">Find something to book</LinkButton></Empty>
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <Link key={b.id} href={`/booking/${b.code}?phone=${encodeURIComponent(b.guestPhone)}`}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-indigo-300">
                <div>
                  <p className="font-semibold">{b.service?.name}</p>
                  <p className="text-sm text-slate-500">{dateTimeIn(b.startAt, "Asia/Kolkata")} · {b.code}</p>
                </div>
                <div className="flex items-center gap-2"><span className="text-sm font-medium">{money(b.totalMinor)}</span><Badge status={b.status} /><Badge status={b.paymentStatus} /></div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
