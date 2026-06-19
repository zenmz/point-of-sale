import { useState, type CSSProperties, type FormEvent } from "react";
import * as catalogApi from "../../api/catalog";
import { ApiError } from "../../api/client";
import type { Category, Product, ProductInput, Variant } from "../../types/catalog";

interface Props {
  product: Product | null; // null = mode tambah
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

// Bangun nilai awal form dari produk (atau kosong untuk mode tambah).
// Parent memberi `key` berbeda per produk agar komponen di-remount,
// jadi inisialisasi lewat lazy initializer ini sudah cukup (tanpa useEffect).
function initialForm(product: Product | null): ProductInput {
  if (!product) {
    return { category_id: null, name: "", sku: null, barcode: null, price: 0, variants: [] };
  }
  return {
    category_id: product.category_id,
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    price: product.price,
    variants: product.variants ?? [],
  };
}

export function ProductForm({ product, categories, onClose, onSaved }: Props) {
  const [form, setForm] = useState<ProductInput>(() => initialForm(product));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function setField<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setVariant(i: number, patch: Partial<Variant>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, idx) => (idx === i ? { ...v, ...patch } : v)),
    }));
  }

  function addVariant() {
    setForm((f) => ({ ...f, variants: [...f.variants, { name: "", price: null }] }));
  }

  function removeVariant(i: number) {
    setForm((f) => ({ ...f, variants: f.variants.filter((_, idx) => idx !== i) }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    // Bersihkan field kosong jadi null.
    const payload: ProductInput = {
      ...form,
      sku: form.sku?.trim() || null,
      barcode: form.barcode?.trim() || null,
      category_id: form.category_id || null,
      variants: form.variants.filter((v) => v.name.trim() !== ""),
    };
    try {
      if (product) await catalogApi.updateProduct(product.id, payload);
      else await catalogApi.createProduct(payload);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={overlay} onClick={onClose}>
      <form style={modal} onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2 style={{ marginTop: 0 }}>{product ? "Edit Produk" : "Tambah Produk"}</h2>

        {error && <p style={errBox}>{error}</p>}

        <label style={label}>
          Nama Produk
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
            style={input}
          />
        </label>

        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ ...label, flex: 1 }}>
            Harga (Rp)
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setField("price", Number(e.target.value))}
              required
              style={input}
            />
          </label>
          <label style={{ ...label, flex: 1 }}>
            Kategori
            <select
              value={form.category_id ?? ""}
              onChange={(e) => setField("category_id", e.target.value || null)}
              style={input}
            >
              <option value="">— tanpa kategori —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          <label style={{ ...label, flex: 1 }}>
            SKU
            <input
              value={form.sku ?? ""}
              onChange={(e) => setField("sku", e.target.value)}
              style={input}
            />
          </label>
          <label style={{ ...label, flex: 1 }}>
            Barcode
            <input
              value={form.barcode ?? ""}
              onChange={(e) => setField("barcode", e.target.value)}
              style={input}
            />
          </label>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong style={{ fontSize: 14 }}>Varian (opsional)</strong>
            <button type="button" onClick={addVariant} style={smallBtn}>
              + Varian
            </button>
          </div>
          {form.variants.map((v, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                placeholder="Nama varian"
                value={v.name}
                onChange={(e) => setVariant(i, { name: e.target.value })}
                style={{ ...input, flex: 2 }}
              />
              <input
                placeholder="Harga (kosong = ikut produk)"
                type="number"
                min={0}
                value={v.price ?? ""}
                onChange={(e) =>
                  setVariant(i, { price: e.target.value === "" ? null : Number(e.target.value) })
                }
                style={{ ...input, flex: 1 }}
              />
              <button type="button" onClick={() => removeVariant(i)} style={delBtn}>
                ✕
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
          <button type="button" onClick={onClose} style={ghostBtn}>
            Batal
          </button>
          <button type="submit" disabled={busy} style={primaryBtn}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}

const overlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "grid",
  placeItems: "center",
  padding: 16,
  zIndex: 100,
};
const modal: CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 24,
  width: 520,
  maxWidth: "100%",
  maxHeight: "90vh",
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};
const label: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 14 };
const input: CSSProperties = {
  padding: "9px 11px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 14,
};
const primaryBtn: CSSProperties = {
  padding: "9px 18px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const ghostBtn: CSSProperties = {
  padding: "9px 18px",
  background: "#f1f5f9",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const smallBtn: CSSProperties = {
  padding: "5px 10px",
  background: "#e0e7ff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 13,
};
const delBtn: CSSProperties = {
  padding: "0 10px",
  background: "#fee2e2",
  color: "#b91c1c",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};
const errBox: CSSProperties = {
  background: "#fee2e2",
  color: "#b91c1c",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
  margin: 0,
};
