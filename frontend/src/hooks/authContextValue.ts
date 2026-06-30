import { createContext } from "react";
import type { RegisterInput } from "../api/auth";
import type { User } from "../types/auth";

export interface AuthState {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  switchStore: (storeId: string) => Promise<void>;
  logout: () => void;
}

export const AuthCtx = createContext<AuthState | null>(null);
