export interface TrendPoint {
  date: string;
  total: number;
}

export interface Margin {
  revenue: number;
  cost: number;
  profit: number;
  margin_pct: number;
}

export interface StockAlert {
  product_id: string;
  name: string;
  quantity: number;
  avg_daily: number;
  days_left: number | null;
}

export interface AnalyticsDashboard {
  days: number;
  sales_trend: TrendPoint[];
  margin: Margin;
  low_stock: StockAlert[];
}
