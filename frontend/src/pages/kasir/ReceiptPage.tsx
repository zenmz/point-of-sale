import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as txApi from "../../api/transaction";
import { ApiError } from "../../api/client";
import type { Transaction } from "../../types/transaction";
import { Receipt } from "./Receipt";

export function ReceiptPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [width, setWidth] = useState<58 | 80>(80);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    txApi
      .getTransaction(id)
      .then(setTx)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Gagal memuat transaksi"));
  }, [id]);

  async function onShare() {
    const url = window.location.href;
    const title = tx ? `Struk #${tx.number} — ${tx.store_name}` : "Struk";
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // dibatalkan / tak didukung — fallback ke salin tautan
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Tautan struk disalin");
      setTimeout(() => setShareMsg(null), 2000);
    } catch {
      setShareMsg(url);
    }
  }

  if (error) {
    return (
      <div className="stack">
        <p className="err-box">{error}</p>
        <button className="btn btn-ghost" onClick={() => navigate("/kasir")}>
          ← Kembali ke kasir
        </button>
      </div>
    );
  }

  if (!tx) return <p className="muted">Memuat struk…</p>;

  return (
    <div className="receipt-page">
      <div className="receipt-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/kasir")}>
          ← Kasir
        </button>
        <div className="seg">
          <button
            className={`seg-btn${width === 58 ? " active" : ""}`}
            onClick={() => setWidth(58)}
          >
            58mm
          </button>
          <button
            className={`seg-btn${width === 80 ? " active" : ""}`}
            onClick={() => setWidth(80)}
          >
            80mm
          </button>
        </div>
        <div className="row" style={{ gap: "0.5rem", marginLeft: "auto" }}>
          <button className="btn btn-ghost btn-sm" onClick={onShare}>
            Bagikan
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            Cetak / PDF
          </button>
        </div>
      </div>

      {shareMsg && <p className="muted receipt-sharemsg">{shareMsg}</p>}

      <div className="receipt-stage">
        <Receipt tx={tx} width={width} />
      </div>
    </div>
  );
}
