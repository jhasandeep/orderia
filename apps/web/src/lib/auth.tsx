"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, getToken, setToken } from "./api";
import type { Membership, User } from "./types";

interface AuthState {
  user: User | null;
  memberships: Membership[];
  /** False until we know whether someone is signed in (so pages do not flash the wrong thing). */
  ready: boolean;
  /** Resolves to how many businesses the person works at. */
  login: (email: string, password: string) => Promise<number>;
  register: (data: { name: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<number>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setMemberships([]);
      return 0;
    }
    try {
      const me = await api.get<{ user: User; memberships: Membership[] }>("/auth/me");
      setUser(me.user);
      setMemberships(me.memberships);
      return me.memberships.length;
    } catch {
      setToken(null); // expired or invalid
      setUser(null);
      setMemberships([]);
      return 0;
    }
  }, []);

  useEffect(() => {
    load().finally(() => setReady(true));
  }, [load]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      memberships,
      ready,
      refresh: load,
      login: async (email, password) => {
        const r = await api.post<{ token: string }>("/auth/login", { email, password });
        setToken(r.token);
        return load();
      },
      register: async (data) => {
        const r = await api.post<{ token: string }>("/auth/register", data);
        setToken(r.token);
        await load();
      },
      logout: () => {
        setToken(null);
        setUser(null);
        setMemberships([]);
      },
    }),
    [user, memberships, ready, load],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
