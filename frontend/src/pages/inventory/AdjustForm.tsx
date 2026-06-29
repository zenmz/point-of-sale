import { useState, type FormEvent } from "react";
import * as inventoryApi from "../../api/inventory";
import { ApiError } from "../../api/client";
import type { InventoryItem, MovementType } from "../../types/inventory";

interface Props {
  item: InventoryItem;
  onClose: () => void;
  onSaved: () => void;
}

const TYPES: { value: MovementType; label: string; hint: string }[] = [
  { value: "masuk", label: "Barang masuk", hint: "Tambah ke stok saat ini" },
  { value: "keluar", label: "Barang keluar", hint: "Kurangi dari stok saat ini" },
  {
    value: "penyesuaian",
    label: "Penyesuaian",
    hint: "Set stok ke nilai pasti (hasil hitung fisik)",
  },
];

export function AdjustForm({ item, onClose, onSaved }: Props) {
  const [type, setType] = useState<MovementType>("masuk");
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const conf = TYPES.find((t) => t.value === type)!;
  // Pratinjau stok hasil perubahan.
  const preview =
    type === "masuk" ? item.quantity + qty : type === "keluar" ? item.quantity - qty : qty;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await inventoryApi.adjustStock(item.product_id, {
        type,
        qty,
        reason: reason.trim() || null,
      });
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
        <h2>Atur Stok</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {item.name} · stok saat ini <strong>{item.quantity}</strong>
        </p>

        {error && <p className="err-box">{error}</p>}

        <label className="field">
          Jenis
          <select
            className="input"
            value={type}
            onChange={(e) => setType(e.target.value as MovementType)}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="muted" style={{ fontSize: "0.8rem" }}>
            {conf.hint}
          </span>
        </label>

        <label className="field">
          {type === "penyesuaian" ? "Stok fisik (jumlah pasti)" : "Jumlah"}
          <input
            className="input"
            type="number"
            min={0}
            value={qty}
            onChange={(e) => setQty(Math.max(0, Number(e.target.value)))}
            required
            autoFocus
          />
        </label>

        <label className="field">
          Alasan / catatan (opsional)
          <input
            className="input"
            value={reason}
            placeholder="mis. kiriman supplier, barang rusak, stok opname"
            onChange={(e) => setReason(e.target.value)}
          />
        </label>

        <p className={`stock-preview${preview < 0 ? " bad" : ""}`}>
          Stok setelah perubahan: <strong>{preview}</strong>
          {preview < 0 && " — melebihi stok tersedia"}
        </p>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Batal
          </button>
          <button type="submit" disabled={busy || preview < 0} className="btn btn-primary">
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
