import Dexie, { type Table } from "dexie";
import type { Category, Product } from "../types/catalog";
import type { CheckoutInput } from "../types/transaction";

export type PendingStatus = "pending" | "error";

// Transaksi yang dibuat offline, menunggu sinkronisasi ke server.
export interface PendingTx {
  client_id: string; // UUID idempotensi
  payload: CheckoutInput;
  total: number;
  created_at: number; // epoch ms
  status: PendingStatus;
  error?: string;
}

// Basis data lokal (IndexedDB via Dexie) untuk mode offline.
// v1: cache katalog. v2: antrian transaksi offline (M2.1).
export class MzposDB extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;
  pendingTx!: Table<PendingTx, string>;

  constructor() {
    super("mzpos");
    this.version(1).stores({
      products: "id, name, sku, barcode, category_id",
      categories: "id, name",
    });
    this.version(2).stores({
      products: "id, name, sku, barcode, category_id",
      categories: "id, name",
      pendingTx: "client_id, status, created_at",
    });
  }
}

export const db = new MzposDB();
