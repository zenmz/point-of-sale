export interface SalesSummary {
  total_sales: number;
  tx_count: number;
  total_discount: number;
  total_tax: number;
  avg_sale: number;
}

export interface DailySales {
  date: string; // YYYY-MM-DD
  tx_count: number;
  total: number;
}

export interface SalesReport {
  summary: SalesSummary;
  daily: DailySales[];
}

export interface TopProduct {
  product_id: string | null;
  name: string;
  qty_sold: number;
  total: number;
}

export interface PaymentBreakdown {
  method: string;
  count: number;
  total: number;
}
