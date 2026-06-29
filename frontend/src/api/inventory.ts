import { api } from "./client";
import type { AdjustInput, InventoryItem, Movement } from "../types/inventory";

export const listInventory = (search = "") =>
  api.get<InventoryItem[]>(
    `/api/v1/inventory${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  );

export const listMovements = (productId: string) =>
  api.get<Movement[]>(`/api/v1/inventory/${productId}/movements`);

export const adjustStock = (productId: string, input: AdjustInput) =>
  api.post<Movement>(`/api/v1/inventory/${productId}/adjust`, input);
