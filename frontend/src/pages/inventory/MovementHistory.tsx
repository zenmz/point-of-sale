import { useEffect, useState } from "react";
import * as inventoryApi from "../../api/inventory";
import type { InventoryItem, Movement, MovementType } from "../../types/inventory";

interface Props {
  item: InventoryItem;
  onClose: () => void;
}

const TYPE_LABEL: Record<MovementType, string> = {
  masuk: "Masuk",
  keluar: "Keluar",
  penyesuaian: "Penyesuaian",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MovementHistory({ item, onClose }: Props) {
  const [moves, setMoves] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventoryApi
      .listMovements(item.product_id)
      .then(setMoves)
      .finally(() => setLoading(false));
  }, [item.product_id]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Riwayat Stok</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          {item.name} · stok kini <strong>{item.quantity}</strong>
        </p>

        {loading ? (
          <p className="muted">Memuat…</p>
        ) : moves.length === 0 ? (
          <p className="muted">Belum ada pergerakan stok.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Jenis</th>
                <th className="num">Perubahan</th>
                <th className="num">Sisa</th>
                <th>Oleh</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {formatWhen(m.created_at)}
                  </td>
                  <td>
                    {TYPE_LABEL[m.type]}
                    {m.reason && (
                      <div className="muted" style={{ fontSize: "0.8rem" }}>
                        {m.reason}
                      </div>
                    )}
                  </td>
                  <td className={`num${m.delta < 0 ? " danger" : ""}`} style={{ fontWeight: 600 }}>
                    {m.delta > 0 ? `+${m.delta}` : m.delta}
                  </td>
                  <td className="num">{m.qty_after}</td>
                  <td className="muted">{m.user_name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
