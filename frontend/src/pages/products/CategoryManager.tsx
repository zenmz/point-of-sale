import { useEffect, useState, type FormEvent } from "react";
import * as catalogApi from "../../api/catalog";
import { ApiError } from "../../api/client";
import type { Category } from "../../types/catalog";

// CategoryManager: kelola kategori (tambah/ubah/hapus) tanpa pindah halaman.
export function CategoryManager({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setItems(await catalogApi.listCategories());
  }
  useEffect(() => {
    const t = setTimeout(() => load().catch(() => setError("Gagal memuat")), 0);
    return () => clearTimeout(t);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    setError(null);
    try {
      if (editing) await catalogApi.updateCategory(editing.id, n);
      else await catalogApi.createCategory(n);
      setName("");
      setEditing(null);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Category) {
    if (!confirm(`Hapus kategori "${c.name}"? Produk terkait jadi tanpa kategori.`)) return;
    setError(null);
    try {
      await catalogApi.deleteCategory(c.id);
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menghapus");
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2>Kelola Kategori</h2>
        {error && <p className="err-box">{error}</p>}

        <form onSubmit={submit} className="row" style={{ gap: "0.5rem", marginBottom: "0.75rem" }}>
          <input
            className="input"
            placeholder={editing ? `Ubah "${editing.name}"…` : "Nama kategori baru…"}
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          {editing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(null);
                setName("");
              }}
            >
              Batal
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {editing ? "Simpan" : "Tambah"}
          </button>
        </form>

        {items.length === 0 ? (
          <p className="muted">Belum ada kategori.</p>
        ) : (
          <div className="sync-list" style={{ maxHeight: "40vh" }}>
            {items.map((c) => (
              <div key={c.id} className="sync-item">
                <span>{c.name}</span>
                <span className="row" style={{ gap: "0.5rem" }}>
                  <button
                    className="btn-link"
                    onClick={() => {
                      setEditing(c);
                      setName(c.name);
                    }}
                  >
                    Edit
                  </button>
                  <button className="btn-link danger" onClick={() => remove(c)}>
                    Hapus
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: "0.75rem" }}>
          Tutup
        </button>
      </div>
    </div>
  );
}
