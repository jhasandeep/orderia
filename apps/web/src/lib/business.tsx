"use client";

import { useParams } from "next/navigation";
import { api } from "./api";
import { useAuth } from "./auth";
import { useLoad } from "./hooks";
import type { Membership, Role } from "./types";

/** The business in the URL and what the signed-in user may do there. */
export function useBiz() {
  const { businessId } = useParams<{ businessId: string }>();
  const { memberships } = useAuth();
  const membership: Membership | undefined = memberships.find((m) => m.business.id === businessId);
  return {
    businessId,
    membership,
    business: membership?.business,
    role: membership?.role,
    can: (...roles: Role[]) => Boolean(membership && roles.includes(membership.role)),
  };
}

export const toMinor = (rupees: string | number) => Math.round(Number(rupees) * 100);
export const fromMinor = (minor: number) => String(minor / 100);

export interface BusinessInfo {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  timezone: string;
  currency: string;
  modules: string[];
  active: boolean;
  settings: { slotIntervalMinutes: number; minNoticeMinutes: number; autoConfirm: boolean; checkInTime: string; checkOutTime: string };
}

/** Full details of the business in the URL (time zone, settings…). */
export function useBusinessInfo() {
  const { businessId } = useBiz();
  const r = useLoad(() => api.get<BusinessInfo>(`/businesses/${businessId}`), [businessId]);
  return { ...r, info: r.data, tz: r.data?.timezone ?? "Asia/Kolkata", businessId };
}
