export interface Supplier {
  id: string;
  store_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export type POStatus = "dipesan" | "diterima" | "batal";

export interface POItem {
  id: string;
  product_id: string | null;
  name: string;
  qty: number;
  cost: number;
  subtotal: number;
}

export interface PO {
  id: string;
  store_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  number: number;
  status: POStatus;
  total: number;
  is_paid: boolean;
  note: string | null;
  created_at: string;
  received_at: string | null;
  items?: POItem[];
}

export interface Debt {
  total: number;
  count: number;
}
