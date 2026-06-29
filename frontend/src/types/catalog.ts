export interface Category {
  id: string;
  store_id: string;
  name: string;
  created_at: string;
}

export interface Variant {
  id?: string;
  product_id?: string;
  name: string;
  sku?: string | null;
  price?: number | null; // null = pakai harga produk
  created_at?: string;
}

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  is_active: boolean;
  created_at: string;
  variants?: Variant[];
  variant_count: number;
  stock: number;
}

// Payload untuk create/update produk.
export interface ProductInput {
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  variants: Variant[];
}
