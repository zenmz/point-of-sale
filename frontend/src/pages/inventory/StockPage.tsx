import { useCallback, useEffect, useState } from "react";
import * as inventoryApi from "../../api/inventory";
import { useAuth } from "../../hooks/useAuth";
import type { InventoryItem } from "../../types/inventory";
import { AdjustForm } from "./AdjustForm";
import { MovementHistory } from "./MovementHistory";
import { TransferForm } from "./TransferForm";
import { OpnameForm } from "./OpnameForm";

// Ambang stok menipis (MVP: tetap; konfigurasi per produk menyusul).
const LOW_STOCK = 5;

export function StockPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "owner";
  const isOwner = user?.role === "owner";

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryItem | null>(null);
  const [transfer, setTransfer] = useState(false);
  const [opname, setOpname] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setItems(await inventoryApi.listInventory(q));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const lowCount = items.filter((i) => i.quantity <= LOW_STOCK).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Stok</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {items.length} produk
            {lowCount > 0 && ` · ${lowCount} menipis`}
          </p>
        </div>
        {canEdit && (
          <div className="row" style={{ gap: "0.5rem" }}>
            <button className="btn btn-ghost" onClick={() => setOpname(true)}>
              Opname
            </button>
            {isOwner && (
              <button className="btn btn-primary" onClick={() => setTransfer(true)}>
                Transfer
              </button>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "1rem" }}>
          <input
            className="input"
            placeholder="Cari nama atau SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p className="muted" style={{ padding: "0 1rem 1rem" }}>
            Memuat…
          </p>
        ) : items.length === 0 ? (
          <p className="muted" style={{ padding: "0 1rem 1.5rem" }}>
            Belum ada produk. Tambah produk dulu di menu <strong>Produk</strong>.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>SKU</th>
                <th className="num">Stok</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.product_id}>
                  <td style={{ fontWeight: 500 }}>{it.name}</td>
                  <td className="muted">{it.sku ?? "—"}</td>
                  <td className="num">
                    <span style={{ fontWeight: 600 }}>{it.quantity}</span>
                    {it.quantity <= LOW_STOCK && (
                      <span className="chip chip-accent" style={{ marginLeft: 8 }}>
                        {it.quantity === 0 ? "habis" : "menipis"}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="num" style={{ whiteSpace: "nowrap" }}>
                      <button onClick={() => setAdjusting(it)} className="btn-link">
                        Atur
                      </button>
                      <button onClick={() => setHistory(it)} className="btn-link">
                        Riwayat
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjusting && (
        <AdjustForm
          item={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            load(search);
          }}
        />
      )}

      {history && <MovementHistory item={history} onClose={() => setHistory(null)} />}

      {transfer && (
        <TransferForm
          items={items.filter((i) => i.quantity > 0)}
          onClose={() => setTransfer(false)}
          onSaved={() => {
            setTransfer(false);
            load(search);
          }}
        />
      )}

      {opname && (
        <OpnameForm
          items={items}
          onClose={() => setOpname(false)}
          onSaved={() => {
            setOpname(false);
            load(search);
          }}
        />
      )}
    </div>
  );
}
