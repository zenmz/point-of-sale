import type { Product } from "../../types/catalog";

// Satu baris keranjang: snapshot produk + qty & diskon yang sedang diedit kasir.
export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  stock: number;
  qty: number;
  discount: number; // diskon per item (Rp)
}

export interface Totals {
  subtotal: number;
  discount: number;
  afterDiscount: number;
  tax: number;
  service: number;
  total: number;
}

export function lineTotal(line: CartLine): number {
  return Math.max(0, line.price * line.qty - clampNonNeg(line.discount));
}

export function clampNonNeg(v: number): number {
  return v > 0 ? Math.round(v) : 0;
}

// computeTotals meniru perhitungan server agar pratinjau cocok dengan hasil checkout.
export function computeTotals(
  lines: CartLine[],
  notaDiscount: number,
  taxPercent: number,
  servicePercent: number,
): Totals {
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discount = Math.min(clampNonNeg(notaDiscount), subtotal);
  const afterDiscount = subtotal - discount;
  const tax = Math.round((afterDiscount * clampPercent(taxPercent)) / 100);
  const service = Math.round((afterDiscount * clampPercent(servicePercent)) / 100);
  return { subtotal, discount, afterDiscount, tax, service, total: afterDiscount + tax + service };
}

export function newLine(p: Product): CartLine {
  return { product_id: p.id, name: p.name, price: p.price, stock: p.stock, qty: 1, discount: 0 };
}

function clampPercent(p: number): number {
  if (p < 0) return 0;
  if (p > 100) return 100;
  return p;
}
