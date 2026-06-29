import { api } from "./client";
import type { CheckoutInput, Transaction } from "../types/transaction";

export const checkout = (input: CheckoutInput) =>
  api.post<Transaction>("/api/v1/transactions", input);

export const getTransaction = (id: string) => api.get<Transaction>(`/api/v1/transactions/${id}`);
