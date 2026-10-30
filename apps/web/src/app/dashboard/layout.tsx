"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { ModuleName, Role } from "@/lib/types";
import { Spinner } from "@/components/ui";

interface Item {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  module?: ModuleName;
}

const ITEMS: Item[] = [
  { href: "", label: "Overview", icon: "🏠", roles: ["OWNER", "MANAGER", "RECEPTION"] },
  { href: "/bookings", label: "Bookings", icon: "📅", roles: ["OWNER", "MANAGER", "RECEPTION", "PROVIDER"], module: "APPOINTMENTS" },
  { href: "/services", label: "Services & rooms", icon: "✂️", roles: ["OWNER", "MANAGER"], module: "APPOINTMENTS" },
  { href: "/providers", label: "Staff & hours", icon: "🧑‍⚕️", roles: ["OWNER", "MANAGER"], module: "APPOINTMENTS" },
  { href: "/orders", label: "Kitchen orders", icon: "🍳", roles: ["OWNER", "MANAGER", "RECEPTION", "KITCHEN"], module: "DINING" },
  { href: "/menu", label: "Menu", icon: "📖", roles: ["OWNER", "MANAGER", "KITCHEN"], module: "DINING" },
  { href: "/tables", label: "Tables & QR", icon: "🔲", roles: ["OWNER", "MANAGER", "RECEPTION"], module: "DINING" },
  { href: "/reservations", label: "Table bookings", icon: "🪑", roles: ["OWNER", "MANAGER", "RECEPTION"], module: "DINING" },
  { href: "/payments", label: "Payments", icon: "💳", roles: ["OWNER", "MANAGER", "RECEPTION"] },
  { href: "/team", label: "Team", icon: "👥", roles: ["OWNER", "MANAGER"] },
  { href: "/settings", label: "Settings", icon: "⚙️", roles: ["OWNER", "MANAGER"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const params = useParams<{ businessId?: string }>();
  const { user, memberships, ready } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace(`/login?next=${encodeURIComponent(path)}`);
  }, [ready, user, router, path]);

  if (!ready || !user) return <Spinner />;
  const current = memberships.find((m) => m.business.id === params.businessId);
  const base = current ? `/dashboard/${current.business.id}` : "";
  const items = current ? ITEMS.filter((i) => i.roles.includes(current.role) && (!i.module || current.business.modules.includes(i.module))) : [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 lg:flex-row">
      {current && (
        <aside className="shrink-0 lg:w-60">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-24">
            <div className="flex items-center justify-between lg:block">
              <select
                aria-label="Switch business"
                value={current.business.id}
                onChange={(e) => {
                  const m = memberships.find((x) => x.business.id === e.target.value)!;
                  router.push(`/dashboard/${m.business.id}`);
                }}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-sm font-semibold"
              >
                {memberships.map((m) => (
                  <option key={m.business.id} value={m.business.id}>{m.business.name}</option>
                ))}
              </select>
              <button className="ml-2 rounded-lg border border-slate-300 px-3 py-2 text-sm lg:hidden" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu">☰</button>
            </div>
            <p className="mt-2 hidden px-1 text-xs text-slate-500 lg:block">Signed in as <strong>{current.role.toLowerCase()}</strong></p>
            <nav className={`${menuOpen ? "mt-3 flex" : "hidden"} flex-col gap-0.5 lg:mt-3 lg:flex`}>
              {items.map((i) => {
                const href = `${base}${i.href}`;
                const active = i.href === "" ? path === base : path.startsWith(href);
                return (
                  <Link key={i.href} href={href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${active ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100"}`}>
                    <span aria-hidden>{i.icon}</span>
                    {i.label}
                  </Link>
                );
              })}
              <Link href={`/b/${current.business.slug}`} target="_blank" className="mt-2 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">View public page ↗</Link>
              <Link href="/dashboard/new" className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100">+ Add another business</Link>
            </nav>
          </div>
        </aside>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
