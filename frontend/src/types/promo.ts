export type PromoType = "nota_percent" | "product_qty" | "happy_hour";

export interface Promotion {
  id: string;
  store_id: string;
  name: string;
  type: PromoType;
  percent: number;
  min_purchase: number;
  product_id: string | null;
  min_qty: number;
  start_hour: number | null;
  end_hour: number | null;
  is_active: boolean;
  created_at: string;
}

export interface PromoPreview {
  discount: number;
  applied: string[];
}
