"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAction } from "@/lib/hooks";
import { useAuth } from "@/lib/auth";
import { Button, Card, ErrorNote, Field, Input } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { login, register } = useAuth();
  const { busy, error, run } = useAction();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const jobs = await run(async () => {
      if (mode === "login") return { jobs: await login(form.email, form.password) };
      await register({ name: form.name, email: form.email, phone: form.phone || undefined, password: form.password });
      return { jobs: 0 };
    });
    if (jobs) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : jobs.jobs > 0 ? "/dashboard" : "/");
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <Card className="p-6">
        <h1 className="text-2xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-500">{mode === "login" ? "Sign in to see your bookings or manage your business." : "Book faster, and manage a business too if you run one."}</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "register" && (
            <>
              <Field label="Your name"><Input value={form.name} onChange={set("name")} required minLength={2} autoComplete="name" /></Field>
              <Field label="Phone (optional)"><Input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></Field>
            </>
          )}
          <Field label="Email"><Input type="email" value={form.email} onChange={set("email")} required autoComplete="email" /></Field>
          <Field label="Password" hint={mode === "register" ? "At least 8 characters." : undefined}><Input type="password" value={form.password} onChange={set("password")} required minLength={mode === "register" ? 8 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} /></Field>
          <ErrorNote>{error}</ErrorNote>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {mode === "login" ? (
            <>New here? <Link href="/register" className="font-medium text-indigo-600">Create an account</Link></>
          ) : (
            <>Already have an account? <Link href="/login" className="font-medium text-indigo-600">Sign in</Link></>
          )}
        </p>
      </Card>
    </div>
  );
}
