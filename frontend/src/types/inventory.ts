export type MovementType = "masuk" | "keluar" | "penyesuaian";

export interface InventoryItem {
  product_id: string;
  name: string;
  sku: string | null;
  quantity: number;
  updated_at: string;
}

export interface Movement {
  id: string;
  product_id: string;
  type: MovementType;
  delta: number;
  qty_after: number;
  reason: string | null;
  user_name: string | null;
  created_at: string;
}

// Payload untuk menyesuaikan stok satu produk.
export interface AdjustInput {
  type: MovementType;
  qty: number; // jumlah (masuk/keluar) atau nilai target (penyesuaian)
  reason: string | null;
}

// Transfer stok antar cabang.
export interface Transfer {
  id: string;
  from_store_id: string;
  from_store_name: string;
  to_store_id: string;
  to_store_name: string;
  product_id: string;
  product_name: string;
  qty: number;
  note: string | null;
  created_at: string;
}

export interface OpnameItem {
  product_id: string;
  physical: number;
}

export interface OpnameResult {
  product_id: string;
  name: string;
  system_qty: number;
  physical: number;
  difference: number; // fisik − sistem
}
