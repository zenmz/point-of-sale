import { api } from "./client";
import type { Store } from "../types/store";
import type { AuthResponse } from "../types/auth";

export interface StoreInput {
  name: string;
  address?: string | null;
  phone?: string | null;
  is_active?: boolean;
  copy_catalog_from?: string | null; // hanya saat create
}

export function listStores() {
  return api.get<Store[]>("/api/v1/stores");
}

export function createStore(input: StoreInput) {
  return api.post<Store>("/api/v1/stores", input);
}

export function updateStore(id: string, input: StoreInput) {
  return api.patch<Store>(`/api/v1/stores/${id}`, input);
}

// switchStore menerbitkan ulang token untuk cabang lain (owner).
export function switchStore(id: string) {
  return api.post<AuthResponse>(`/api/v1/stores/${id}/switch`);
}
