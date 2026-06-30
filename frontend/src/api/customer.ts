import { api } from "./client";
import type { Customer, CustomerDetail } from "../types/customer";

export interface CustomerInput {
  name: string;
  phone?: string | null;
  email?: string | null;
}

export const listCustomers = (search = "") =>
  api.get<Customer[]>(
    `/api/v1/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`,
  );

export const getCustomer = (id: string) => api.get<CustomerDetail>(`/api/v1/customers/${id}`);

export const createCustomer = (input: CustomerInput) =>
  api.post<Customer>("/api/v1/customers", input);

export const updateCustomer = (id: string, input: CustomerInput) =>
  api.put<Customer>(`/api/v1/customers/${id}`, input);

export const redeemPoints = (id: string, points: number, note?: string) =>
  api.post<Customer>(`/api/v1/customers/${id}/redeem`, { points, note: note ?? null });
