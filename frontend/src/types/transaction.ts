export type TransactionStatus = "selesai" | "batal";

export type PaymentMethod = "tunai" | "qris" | "ewallet" | "transfer";

export interface Payment {
  method: PaymentMethod;
  amount: number;
  change: number;
}

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
  store_name: string;
  store_address: string | null;
  store_phone: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  customer_id: string | null;
  customer_name: string | null;
  points_earned: number;
  number: number;
  subtotal: number;
  discount: number;
  promo_discount: number;
  tax_percent: number;
  tax: number;
  service_percent: number;
  service_charge: number;
  total: number;
  status: TransactionStatus;
  created_at: string;
  items: TransactionItem[];
  payment: Payment | null;
}

// Payload checkout. Total dihitung ulang otoritatif di server.
export interface CheckoutItem {
  product_id: string;
  variant_id?: string;
  qty: number;
  discount: number;
}

export interface CheckoutInput {
  items: CheckoutItem[];
  discount: number;
  tax_percent: number;
  service_percent: number;
  method: PaymentMethod;
  paid_amount: number;
  client_id?: string; // UUID idempotensi (transaksi offline)
  customer_id?: string; // member opsional (akumulasi poin)
}
