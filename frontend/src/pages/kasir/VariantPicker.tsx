import { formatRupiah } from "../../lib/format";
import type { Product } from "../../types/catalog";
import { newLine, newVariantLine, type CartLine } from "./cart";

// VariantPicker: pilih varian (atau produk dasar) saat menambah ke keranjang.
// Harga varian (bila ada) menggantikan harga produk.
export function VariantPicker({
  product,
  onClose,
  onPick,
}: {
  product: Product;
  onClose: () => void;
  onPick: (line: CartLine) => void;
}) {
  const variants = product.variants ?? [];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2>Pilih varian</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {product.name}
        </p>
        <div className="sync-list" style={{ maxHeight: "50vh" }}>
          <button className="pick-item" onClick={() => onPick(newLine(product))}>
            <span className="pick-name">Produk dasar</span>
            <span className="money">{formatRupiah(product.price)}</span>
          </button>
          {variants.map((v) => (
            <button key={v.id} className="pick-item" onClick={() => onPick(newVariantLine(product, v))}>
              <span className="pick-name">{v.name}</span>
              <span className="money">{formatRupiah(v.price ?? product.price)}</span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: "0.5rem" }}>
          Batal
        </button>
      </div>
    </div>
  );
}
