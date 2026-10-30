"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui";

/** Sends people to the right first screen for their role. */
export default function DashboardHome() {
  const router = useRouter();
  const { memberships, ready } = useAuth();
  useEffect(() => {
    if (!ready) return;
    const m = memberships[0];
    if (!m) router.replace("/dashboard/new");
    else router.replace(`/dashboard/${m.business.id}${m.role === "KITCHEN" ? "/orders" : m.role === "PROVIDER" ? "/bookings" : ""}`);
  }, [ready, memberships, router]);
  return <Spinner />;
}
