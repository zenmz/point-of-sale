import { api } from "./client";
import type { CheckoutInput, CheckoutItem, Transaction } from "../types/transaction";

export const checkout = (input: CheckoutInput) =>
  api.post<Transaction>("/api/v1/transactions", input);

export const getTransaction = (id: string) => api.get<Transaction>(`/api/v1/transactions/${id}`);

// Quote = rincian total otoritatif (sama dgn checkout) tanpa menyimpan. Dipakai
// kasir agar total tampil & jumlah bayar persis sama dengan server (termasuk
// promo otomatis, diskon item/nota, pajak — urutan benar).
export interface QuoteInput {
  items: CheckoutItem[];
  discount: number;
  tax_percent: number;
  service_percent: number;
}

export interface QuoteResult {
  subtotal: number;
  discount: number;
  promo_discount: number;
  tax_percent: number;
  tax: number;
  service_percent: number;
  service_charge: number;
  total: number;
}

export const quote = (input: QuoteInput) =>
  api.post<QuoteResult>("/api/v1/transactions/quote", input);
