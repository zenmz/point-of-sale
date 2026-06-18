import { useState, type ReactNode } from "react";
import { getToken, setToken } from "../api/client";
import * as authApi from "../api/auth";
import type { AuthResponse, User } from "../types/auth";
import { AuthCtx } from "./authContextValue";

const USER_KEY = "mzpos_user";

// Pulihkan sesi dari localStorage (dipanggil sekali saat inisialisasi state).
function restoreUser(): User | null {
  const token = getToken();
  const raw = localStorage.getItem(USER_KEY);
  if (!token || !raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreUser);

  function persist(res: AuthResponse) {
    setToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  }

  async function login(email: string, password: string) {
    persist(await authApi.login(email, password));
  }

  async function register(input: authApi.RegisterInput) {
    persist(await authApi.register(input));
  }

  function logout() {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>;
}
