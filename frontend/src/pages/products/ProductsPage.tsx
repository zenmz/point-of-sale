import { useCallback, useEffect, useState } from "react";
import * as catalogApi from "../../api/catalog";
import { useAuth } from "../../hooks/useAuth";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Category, Product } from "../../types/catalog";
import { ProductForm } from "./ProductForm";
import { CategoryManager } from "./CategoryManager";

export function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [catOpen, setCatOpen] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const [prods, cats] = await Promise.all([
        catalogApi.listProducts(q),
        catalogApi.listCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce pencarian.
  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setFormOpen(true);
  }

  async function onDelete(p: Product) {
    if (!confirm(`Hapus produk "${p.name}"?`)) return;
    await catalogApi.deleteProduct(p.id);
    load(search);
  }

  function catName(id: string | null) {
    return categories.find((c) => c.id === id)?.name ?? "—";
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Produk</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {products.length} produk aktif
          </p>
        </div>
        {canEdit && (
          <div className="row" style={{ gap: "0.5rem" }}>
            <button onClick={() => setCatOpen(true)} className="btn btn-ghost">
              Kategori
            </button>
            <button onClick={openAdd} className="btn btn-primary">
              <IconPlus size={18} />
              Tambah Produk
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "1rem" }}>
          <input
            className="input"
            placeholder="Cari nama, SKU, atau barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="muted" style={{ padding: "0 1rem 1rem" }}>
            Memuat…
          </p>
        ) : products.length === 0 ? (
          <p className="muted" style={{ padding: "0 1rem 1.5rem" }}>
            Belum ada produk. Klik <strong>Tambah Produk</strong> untuk mulai.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Kategori</th>
                <th>SKU</th>
                <th className="num">Harga</th>
                <th className="num">Stok</th>
                <th className="center">Varian</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{catName(p.category_id)}</td>
                  <td className="muted">{p.sku ?? "—"}</td>
                  <td className="num money">{formatRupiah(p.price)}</td>
                  <td className="num">
                    {p.stock <= 5 ? <span className="chip chip-accent">{p.stock}</span> : p.stock}
                  </td>
                  <td className="center">
                    {p.variant_count > 0 ? (
                      <span className="chip chip-brand">{p.variant_count}</span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => openEdit(p)} className="btn-link">
                        Edit
                      </button>
                      <button onClick={() => onDelete(p)} className="btn-link danger">
                        Hapus
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && (
        <ProductForm
          key={editing?.id ?? "new"}
          product={editing}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load(search);
          }}
        />
      )}

      {catOpen && (
        <CategoryManager onClose={() => setCatOpen(false)} onChanged={() => load(search)} />
      )}
    </div>
  );
}
