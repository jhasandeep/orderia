"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "./api";

/** Loads data once (and again when `reload` is called or `deps` change). Optionally refreshes every `every` ms. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = [], every?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const fn = useRef(load);
  useEffect(() => {
    fn.current = load;
  });

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await fn.current());
      setError("");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    if (!every) return;
    const t = setInterval(() => reload(true), every);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, every, ...deps]);

  return { data, error, loading, reload, setData };
}

/** Runs an async action with a busy flag and an error message. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(errorText(e));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, run, setError };
}
