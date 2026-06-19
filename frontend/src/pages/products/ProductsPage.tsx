import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import * as catalogApi from "../../api/catalog";
import { useAuth } from "../../hooks/useAuth";
import { formatRupiah } from "../../lib/format";
import type { Category, Product } from "../../types/catalog";
import { ProductForm } from "./ProductForm";

export function ProductsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "owner";

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

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
    <main style={{ fontFamily: "system-ui", padding: "2rem", maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Link to="/" style={{ fontSize: 14, color: "#2563eb" }}>
            ← Dashboard
          </Link>
          <h1 style={{ margin: "4px 0" }}>Produk</h1>
        </div>
        {canEdit && (
          <button onClick={openAdd} style={primaryBtn}>
            + Tambah Produk
          </button>
        )}
      </header>

      <input
        placeholder="Cari nama, SKU, atau barcode…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={searchInput}
      />

      {loading ? (
        <p>Memuat…</p>
      ) : products.length === 0 ? (
        <p style={{ color: "#666" }}>Belum ada produk.</p>
      ) : (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Nama</th>
              <th style={th}>Kategori</th>
              <th style={th}>SKU</th>
              <th style={{ ...th, textAlign: "right" }}>Harga</th>
              <th style={{ ...th, textAlign: "center" }}>Varian</th>
              {canEdit && <th style={th}></th>}
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td style={td}>{p.name}</td>
                <td style={td}>{catName(p.category_id)}</td>
                <td style={td}>{p.sku ?? "—"}</td>
                <td style={{ ...td, textAlign: "right" }}>{formatRupiah(p.price)}</td>
                <td style={{ ...td, textAlign: "center" }}>{p.variant_count}</td>
                {canEdit && (
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => openEdit(p)} style={linkBtn}>
                      Edit
                    </button>
                    <button onClick={() => onDelete(p)} style={{ ...linkBtn, color: "#dc2626" }}>
                      Hapus
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

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
    </main>
  );
}

const primaryBtn: CSSProperties = {
  padding: "9px 16px",
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};
const searchInput: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #ccc",
  borderRadius: 8,
  fontSize: 14,
  margin: "16px 0",
  boxSizing: "border-box",
};
const table: CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "2px solid #e5e7eb",
  color: "#374151",
};
const td: CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f0f0f0" };
const linkBtn: CSSProperties = {
  background: "none",
  border: "none",
  color: "#2563eb",
  cursor: "pointer",
  padding: "0 8px",
  fontSize: 14,
};
