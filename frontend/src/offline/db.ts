import Dexie, { type Table } from "dexie";
import type { Category, Product } from "../types/catalog";

// Basis data lokal (IndexedDB via Dexie) untuk mode offline.
// Fase 2: katalog di-cache di sini; antrian transaksi offline menyusul (M2.1).
export class MzposDB extends Dexie {
  products!: Table<Product, string>;
  categories!: Table<Category, string>;

  constructor() {
    super("mzpos");
    this.version(1).stores({
      products: "id, name, sku, barcode, category_id",
      categories: "id, name",
    });
  }
}

export const db = new MzposDB();
