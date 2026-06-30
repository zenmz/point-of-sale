import { api } from "./client";
import type { Promotion, PromoPreview, PromoType } from "../types/promo";

export interface PromoInput {
  name: string;
  type: PromoType;
  percent: number;
  min_purchase?: number;
  product_id?: string | null;
  min_qty?: number;
  start_hour?: number | null;
  end_hour?: number | null;
  is_active?: boolean;
}

export const listPromotions = () => api.get<Promotion[]>("/api/v1/promotions");
export const createPromotion = (input: PromoInput) => api.post<Promotion>("/api/v1/promotions", input);
export const updatePromotion = (id: string, input: PromoInput) =>
  api.put<Promotion>(`/api/v1/promotions/${id}`, input);
export const deletePromotion = (id: string) => api.del<void>(`/api/v1/promotions/${id}`);

export const previewPromo = (items: { product_id: string; qty: number }[]) =>
  api.post<PromoPreview>("/api/v1/promotions/preview", { items });
