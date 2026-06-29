import { useState, type FormEvent } from "react";
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
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={onSubmit}>
        <h2>{product ? "Edit Produk" : "Tambah Produk"}</h2>

        {error && <p className="err-box">{error}</p>}

        <label className="field">
          Nama Produk
          <input
            className="input"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            required
          />
        </label>

        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            Harga (Rp)
            <input
              className="input"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setField("price", Number(e.target.value))}
              required
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            Kategori
            <select
              className="input"
              value={form.category_id ?? ""}
              onChange={(e) => setField("category_id", e.target.value || null)}
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

        <div className="row">
          <label className="field" style={{ flex: 1 }}>
            SKU
            <input
              className="input"
              value={form.sku ?? ""}
              onChange={(e) => setField("sku", e.target.value)}
            />
          </label>
          <label className="field" style={{ flex: 1 }}>
            Barcode
            <input
              className="input"
              value={form.barcode ?? ""}
              onChange={(e) => setField("barcode", e.target.value)}
            />
          </label>
        </div>

        <hr className="tear" />

        <div>
          <div className="between">
            <strong style={{ fontSize: "0.9rem" }}>Varian (opsional)</strong>
            <button type="button" onClick={addVariant} className="btn btn-ghost btn-sm">
              + Varian
            </button>
          </div>
          {form.variants.map((v, i) => (
            <div key={i} className="row" style={{ marginTop: "0.5rem" }}>
              <input
                className="input"
                placeholder="Nama varian"
                value={v.name}
                onChange={(e) => setVariant(i, { name: e.target.value })}
                style={{ flex: 2 }}
              />
              <input
                className="input"
                placeholder="Harga (kosong = ikut produk)"
                type="number"
                min={0}
                value={v.price ?? ""}
                onChange={(e) =>
                  setVariant(i, { price: e.target.value === "" ? null : Number(e.target.value) })
                }
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => removeVariant(i)}
                className="btn btn-danger btn-sm"
                aria-label="Hapus varian"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Batal
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
