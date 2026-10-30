"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { buttonClass } from "./ui";

export function Nav() {
  const { user, memberships, ready, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const hasBusiness = memberships.length > 0;

  const links = (
    <>
      <Link href="/explore" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)}>
        Explore
      </Link>
      {user && (
        <Link href="/me" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)}>
          My bookings
        </Link>
      )}
      {user && (
        <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={() => setOpen(false)}>
          {hasBusiness ? "Dashboard" : "List your business"}
        </Link>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">O</span>
          Orderia
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">{links}</nav>
        <div className="flex items-center gap-2">
          {ready && !user && (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Sign in
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                Create account
              </Link>
            </>
          )}
          {ready && user && (
            <>
              <span className="hidden text-sm text-slate-600 md:inline">Hi, {user.name.split(" ")[0]}</span>
              <button className={buttonClass("secondary", "sm")} onClick={logout}>
                Sign out
              </button>
            </>
          )}
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 sm:hidden" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
            ☰
          </button>
        </div>
      </div>
      {open && <nav className="flex flex-col border-t border-slate-200 bg-white p-2 sm:hidden">{links}</nav>}
    </header>
  );
}
