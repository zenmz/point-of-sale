import { api } from "./client";
import type { Debt, PO, Supplier } from "../types/purchase";

export interface SupplierInput {
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
}

export const listSuppliers = (search = "") =>
  api.get<Supplier[]>(
    `/api/v1/suppliers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  );

export const createSupplier = (input: SupplierInput) =>
  api.post<Supplier>("/api/v1/suppliers", input);

export const updateSupplier = (id: string, input: SupplierInput) =>
  api.put<Supplier>(`/api/v1/suppliers/${id}`, input);

export interface POItemInput {
  product_id: string;
  qty: number;
  cost: number;
}

export interface CreatePOInput {
  supplier_id?: string;
  note?: string;
  items: POItemInput[];
}

export const listPOs = () => api.get<PO[]>("/api/v1/purchase-orders");
export const getPO = (id: string) => api.get<PO>(`/api/v1/purchase-orders/${id}`);
export const createPO = (input: CreatePOInput) => api.post<PO>("/api/v1/purchase-orders", input);
export const receivePO = (id: string) => api.post<PO>(`/api/v1/purchase-orders/${id}/receive`);
export const payPO = (id: string) => api.post<PO>(`/api/v1/purchase-orders/${id}/pay`);
export const cancelPO = (id: string) => api.post<PO>(`/api/v1/purchase-orders/${id}/cancel`);
export const getDebt = () => api.get<Debt>("/api/v1/purchase-orders/debt");
