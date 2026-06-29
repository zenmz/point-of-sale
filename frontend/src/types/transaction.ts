export type TransactionStatus = "selesai" | "batal";

export interface TransactionItem {
  id: string;
  product_id: string | null;
  name: string;
  price: number;
  qty: number;
  discount: number;
  line_total: number;
}

export interface Transaction {
  id: string;
  store_id: string;
  cashier_id: string | null;
  cashier_name: string | null;
  number: number;
  subtotal: number;
  discount: number;
  tax_percent: number;
  tax: number;
  service_percent: number;
  service_charge: number;
  total: number;
  status: TransactionStatus;
  created_at: string;
  items: TransactionItem[];
}

// Payload checkout. Total dihitung ulang otoritatif di server.
export interface CheckoutItem {
  product_id: string;
  qty: number;
  discount: number;
}

export interface CheckoutInput {
  items: CheckoutItem[];
  discount: number;
  tax_percent: number;
  service_percent: number;
}
