import { createContext } from "react";

export interface SyncState {
  pending: number;
  errors: number;
  syncing: boolean;
  refresh: () => Promise<void>;
  sync: () => Promise<void>;
  retry: () => Promise<void>;
}

export const SyncCtx = createContext<SyncState | null>(null);
