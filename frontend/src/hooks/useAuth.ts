import { useContext } from "react";
import { AuthCtx, type AuthState } from "./authContextValue";

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
}
