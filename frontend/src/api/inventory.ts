import { api } from "./client";
import type {
  AdjustInput,
  InventoryItem,
  Movement,
  OpnameItem,
  OpnameResult,
  Transfer,
} from "../types/inventory";

export const listInventory = (search = "") =>
  api.get<InventoryItem[]>(
    `/api/v1/inventory${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  );

export const listMovements = (productId: string) =>
  api.get<Movement[]>(`/api/v1/inventory/${productId}/movements`);

export const adjustStock = (productId: string, input: AdjustInput) =>
  api.post<Movement>(`/api/v1/inventory/${productId}/adjust`, input);

export interface TransferInput {
  to_store_id: string;
  product_id: string;
  qty: number;
  note?: string | null;
}

export const transferStock = (input: TransferInput) =>
  api.post<Transfer>("/api/v1/inventory/transfer", input);

export const listTransfers = () => api.get<Transfer[]>("/api/v1/inventory/transfers");

export const opname = (items: OpnameItem[]) =>
  api.post<OpnameResult[]>("/api/v1/inventory/opname", { items });
