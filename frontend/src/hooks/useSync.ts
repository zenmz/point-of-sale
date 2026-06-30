import { useContext } from "react";
import { SyncCtx, type SyncState } from "./syncContextValue";

export function useSync(): SyncState {
  const ctx = useContext(SyncCtx);
  if (!ctx) throw new Error("useSync harus dipakai di dalam SyncProvider");
  return ctx;
}
