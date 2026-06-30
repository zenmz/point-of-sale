import { useState, type FormEvent } from "react";
import * as inventoryApi from "../../api/inventory";
import { ApiError } from "../../api/client";
import type { InventoryItem, OpnameResult } from "../../types/inventory";

// OpnameForm: input hitungan fisik per produk, server menyamakan stok sistem
// dan melaporkan selisihnya. Hanya item yang diisi (≠ sistem) dikirim.
export function OpnameForm({
  items,
  onClose,
  onSaved,
}: {
  items: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  // physical[product_id] = nilai fisik (string agar bisa kosong = tak dihitung).
  const [physical, setPhysical] = useState<Record<string, string>>({});
  const [results, setResults] = useState<OpnameResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = items
    .map((it) => ({ it, raw: physical[it.product_id] }))
    .filter((e) => e.raw !== undefined && e.raw !== "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = entries.map((e) => ({
        product_id: e.it.product_id,
        physical: Math.max(0, Number(e.raw)),
      }));
      setResults(await inventoryApi.opname(payload));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal opname");
      setBusy(false);
    }
  }

  if (results) {
    const changed = results.filter((r) => r.difference !== 0);
    return (
      <div className="overlay" onClick={onSaved}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <h2>Hasil Opname</h2>
          <p className="muted" style={{ marginTop: -4 }}>
            {changed.length} produk disesuaikan dari {results.length} dihitung.
          </p>
          <table className="table">
            <thead>
              <tr>
                <th>Produk</th>
                <th className="num">Sistem</th>
                <th className="num">Fisik</th>
                <th className="num">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.product_id}>
                  <td>{r.name}</td>
                  <td className="num">{r.system_qty}</td>
                  <td className="num">{r.physical}</td>
                  <td className={`num${r.difference !== 0 ? " danger" : ""}`}>
                    {r.difference > 0 ? "+" : ""}
                    {r.difference}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-primary btn-block" onClick={onSaved}>
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Stok Opname</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          Isi jumlah fisik hasil hitung. Kosongkan bila produk tidak dihitung.
        </p>
        {error && <p className="err-box">{error}</p>}
        <div className="sync-list" style={{ maxHeight: "50vh" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Produk</th>
                <th className="num">Sistem</th>
                <th className="num">Fisik</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.product_id}>
                  <td>{it.name}</td>
                  <td className="num muted">{it.quantity}</td>
                  <td className="num">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      placeholder="—"
                      style={{ width: 90, textAlign: "right" }}
                      value={physical[it.product_id] ?? ""}
                      onChange={(e) =>
                        setPhysical((p) => ({ ...p, [it.product_id]: e.target.value }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || entries.length === 0}>
            {busy ? "Memproses…" : `Terapkan (${entries.length})`}
          </button>
        </div>
      </form>
    </div>
  );
}
