import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { SyncCtx } from "./syncContextValue";
import { counts, retryErrors, syncPending } from "../offline/sync";

const BASE_BACKOFF = 2000;
const MAX_BACKOFF = 30000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState(0);
  const [errors, setErrors] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<number | null>(null);
  const backoff = useRef(BASE_BACKOFF);
  const syncRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    const c = await counts();
    setPending(c.pending);
    setErrors(c.errors);
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    const res = await syncPending();
    setSyncing(false);
    await refresh();
    if (res.stoppedOffline) {
      // Jaringan flaky → coba lagi dengan backoff eksponensial.
      clearTimer();
      timer.current = window.setTimeout(() => syncRef.current(), backoff.current);
      backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF);
    } else {
      backoff.current = BASE_BACKOFF;
      clearTimer();
    }
  }, [refresh, clearTimer]);

  const retry = useCallback(async () => {
    setSyncing(true);
    await retryErrors();
    setSyncing(false);
    await refresh();
  }, [refresh]);

  // Simpan sync terbaru agar retry terjadwal (setTimeout) tak self-reference.
  useEffect(() => {
    syncRef.current = () => void sync();
  }, [sync]);

  useEffect(() => {
    // Tunda agar tidak setState sinkron di dalam effect.
    const t = window.setTimeout(() => {
      void refresh();
      void sync();
    }, 0);
    const onOnline = () => {
      backoff.current = BASE_BACKOFF;
      void sync();
    };
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", onOnline);
      clearTimer();
    };
  }, [refresh, sync, clearTimer]);

  return (
    <SyncCtx.Provider value={{ pending, errors, syncing, refresh, sync, retry }}>
      {children}
    </SyncCtx.Provider>
  );
}
