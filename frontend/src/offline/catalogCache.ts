import { db } from "./db";
import * as catalogApi from "../api/catalog";
import { ApiError } from "../api/client";
import type { Category, Product } from "../types/catalog";

// Simpan seluruh katalog ke IndexedDB (ganti penuh).
export async function cacheCatalog(products: Product[], categories: Category[]) {
  await db.transaction("rw", db.products, db.categories, async () => {
    await db.products.clear();
    await db.products.bulkPut(products);
    await db.categories.clear();
    await db.categories.bulkPut(categories);
  });
}

function matches(p: Product, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    p.name.toLowerCase().includes(s) ||
    (p.sku?.toLowerCase().includes(s) ?? false) ||
    (p.barcode?.toLowerCase().includes(s) ?? false)
  );
}

export async function getCachedProducts(search: string): Promise<Product[]> {
  const all = await db.products.orderBy("name").toArray();
  return all.filter((p) => matches(p, search));
}

export async function getCachedCategories(): Promise<Category[]> {
  return db.categories.orderBy("name").toArray();
}

// loadProducts mengambil produk dari server (lalu cache) saat online; bila
// jaringan gagal (offline) jatuh ke cache lokal. Error HTTP (mis. 401) dilempar.
// Saat tanpa filter, katalog + kategori di-cache penuh (warming sekali jalan).
export async function loadProducts(
  search: string,
): Promise<{ products: Product[]; offline: boolean }> {
  try {
    const products = await catalogApi.listProducts(search);
    if (search === "") {
      const categories = await catalogApi.listCategories();
      await cacheCatalog(products, categories);
    } else {
      await db.products.bulkPut(products);
    }
    return { products, offline: false };
  } catch (err) {
    if (err instanceof ApiError) throw err; // server menjawab → bukan offline
    return { products: await getCachedProducts(search), offline: true };
  }
}
