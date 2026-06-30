import { useEffect, useState, type FormEvent } from "react";
import * as inventoryApi from "../../api/inventory";
import * as storeApi from "../../api/store";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import type { InventoryItem } from "../../types/inventory";
import type { Store } from "../../types/store";

// TransferForm: pindahkan stok satu produk dari cabang aktif ke cabang lain.
// Produk dipadankan di tujuan via SKU/nama oleh server.
export function TransferForm({
  items,
  onClose,
  onSaved,
}: {
  items: InventoryItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [productId, setProductId] = useState(items[0]?.product_id ?? "");
  const [toStore, setToStore] = useState("");
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    storeApi
      .listStores()
      .then((all) => setStores(all.filter((s) => s.id !== user?.store_id && s.is_active)))
      .catch(() => setStores([]));
  }, [user?.store_id]);

  const selected = items.find((i) => i.product_id === productId);
  const maxQty = selected?.quantity ?? 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await inventoryApi.transferStock({
        to_store_id: toStore,
        product_id: productId,
        qty,
        note: note.trim() || null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal transfer");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Transfer Stok</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          Pindahkan stok dari cabang aktif ke cabang lain.
        </p>
        {error && <p className="err-box">{error}</p>}

        {stores.length === 0 ? (
          <p className="muted">Tidak ada cabang tujuan aktif lain.</p>
        ) : (
          <>
            <label className="field">
              Produk
              <select
                className="input"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                {items.map((it) => (
                  <option key={it.product_id} value={it.product_id}>
                    {it.name} (stok {it.quantity})
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Cabang tujuan
              <select className="input" value={toStore} onChange={(e) => setToStore(e.target.value)}>
                <option value="">— pilih cabang —</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Jumlah (maks {maxQty})
              <input
                className="input"
                type="number"
                min={1}
                max={maxQty}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <label className="field">
              Catatan (opsional)
              <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
          </>
        )}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || !toStore || !productId || qty < 1 || qty > maxQty}
          >
            {busy ? "Mengirim…" : "Transfer"}
          </button>
        </div>
      </form>
    </div>
  );
}
