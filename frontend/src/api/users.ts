import { api } from "./client";
import type { Role, User } from "../types/auth";

export interface CreateUserInput {
  store_id?: string; // owner: cabang tujuan; admin: diabaikan (cabang sendiri)
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput {
  name?: string;
  role?: Role;
  is_active?: boolean;
  password?: string; // kosong = tidak diubah
}

export function listUsers(storeId?: string) {
  const q = storeId ? `?store_id=${encodeURIComponent(storeId)}` : "";
  return api.get<User[]>(`/api/v1/users${q}`);
}

export function createUser(input: CreateUserInput) {
  return api.post<User>("/api/v1/users", input);
}

export function updateUser(id: string, input: UpdateUserInput) {
  return api.patch<User>(`/api/v1/users/${id}`, input);
}
