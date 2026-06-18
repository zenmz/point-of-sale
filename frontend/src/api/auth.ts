import { api } from "./client";
import type { AuthResponse, User } from "../types/auth";

export function login(email: string, password: string) {
  return api.post<AuthResponse>("/api/v1/auth/login", { email, password });
}

export interface RegisterInput {
  store_name: string;
  name: string;
  email: string;
  password: string;
}

export function register(input: RegisterInput) {
  return api.post<AuthResponse>("/api/v1/auth/register", input);
}

export function me() {
  return api.get<{ user_id: string; store_id: string; role: string }>("/api/v1/me");
}

export type { User };
