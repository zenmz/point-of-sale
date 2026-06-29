import { api } from "./client";
import type { PaymentBreakdown, SalesReport, TopProduct } from "../types/report";

function range(from: string, to: string): string {
  return `from=${from}&to=${to}`;
}

export const salesReport = (from: string, to: string) =>
  api.get<SalesReport>(`/api/v1/reports/sales?${range(from, to)}`);

export const topProducts = (from: string, to: string, limit = 10) =>
  api.get<TopProduct[]>(`/api/v1/reports/top-products?${range(from, to)}&limit=${limit}`);

export const paymentMethods = (from: string, to: string) =>
  api.get<PaymentBreakdown[]>(`/api/v1/reports/payment-methods?${range(from, to)}`);
