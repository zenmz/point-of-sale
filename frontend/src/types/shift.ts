export type ShiftStatus = "buka" | "tutup";

export interface ShiftSummary {
  tx_count: number;
  cash_sales: number;
  noncash_sales: number;
  total_sales: number;
  expected_cash: number;
  difference: number;
}

export interface Shift {
  id: string;
  store_id: string;
  user_id: string;
  user_name: string | null;
  opening_cash: number;
  closing_cash: number | null;
  status: ShiftStatus;
  note: string | null;
  opened_at: string;
  closed_at: string | null;
  summary?: ShiftSummary;
}
