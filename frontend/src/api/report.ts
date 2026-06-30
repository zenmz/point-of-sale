import { api } from "./client";
import type { PaymentBreakdown, SalesReport, TopProduct } from "../types/report";

// storeId opsional (owner): "" / undefined = semua cabang (laporan gabungan).
function range(from: string, to: string, storeId?: string): string {
  const q = `from=${from}&to=${to}`;
  return storeId ? `${q}&store_id=${encodeURIComponent(storeId)}` : q;
}

export const salesReport = (from: string, to: string, storeId?: string) =>
  api.get<SalesReport>(`/api/v1/reports/sales?${range(from, to, storeId)}`);

export const topProducts = (from: string, to: string, storeId?: string, limit = 10) =>
  api.get<TopProduct[]>(`/api/v1/reports/top-products?${range(from, to, storeId)}&limit=${limit}`);

export const paymentMethods = (from: string, to: string, storeId?: string) =>
  api.get<PaymentBreakdown[]>(`/api/v1/reports/payment-methods?${range(from, to, storeId)}`);
