import { useMemo, useState } from "react";
import { formatRupiah } from "../../lib/format";
import type { PaymentMethod } from "../../types/transaction";

interface Props {
  total: number;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, paidAmount: number) => void;
}

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "tunai", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "ewallet", label: "E-Wallet" },
  { value: "transfer", label: "Transfer" },
];

// Saran nominal uang tunai: uang pas + pembulatan ke atas ke pecahan umum.
function cashSuggestions(total: number): number[] {
  const steps = [5000, 10000, 20000, 50000, 100000];
  const set = new Set<number>([total]);
  for (const s of steps) {
    const up = Math.ceil(total / s) * s;
    if (up > total) set.add(up);
  }
  return [...set].sort((a, b) => a - b).slice(0, 5);
}

export function PaymentModal({ total, busy, error, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>("tunai");
  // `cash` di-init dari total; bila total berubah, parent me-remount lewat `key`
  // sehingga nilai ini tersegarkan tanpa efek setState.
  const [cash, setCash] = useState(total);

  const suggestions = useMemo(() => cashSuggestions(total), [total]);
  const paid = method === "tunai" ? cash : total;
  const change = paid - total;
  const canPay = paid >= total;

  return (
    <div className="overlay" onClick={busy ? undefined : onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Pembayaran</h2>
        <div className="pay-total">
          <span className="muted">Total tagihan</span>
          <span className="money">{formatRupiah(total)}</span>
        </div>

        {error && <p className="err-box">{error}</p>}

        <div className="pay-methods">
          {METHODS.map((m) => (
            <button
              key={m.value}
              className={`pay-method${method === m.value ? " active" : ""}`}
              onClick={() => setMethod(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {method === "tunai" ? (
          <div className="stack">
            <label className="field">
              Uang diterima
              <input
                className="input"
                type="number"
                min={total}
                value={cash}
                onChange={(e) => setCash(Math.max(0, Number(e.target.value)))}
                autoFocus
              />
            </label>
            <div className="pay-quick">
              {suggestions.map((s) => (
                <button key={s} className="btn btn-ghost btn-sm" onClick={() => setCash(s)}>
                  {s === total ? "Uang pas" : formatRupiah(s)}
                </button>
              ))}
            </div>
            <div className={`pay-change${change < 0 ? " bad" : ""}`}>
              <span>Kembalian</span>
              <span className="money">{formatRupiah(Math.max(0, change))}</span>
            </div>
          </div>
        ) : method === "qris" ? (
          <div className="qris-box">
            <div className="qris-frame" aria-hidden>
              {/* QR statis placeholder (MVP); QR dinamis menyusul */}
              <div className="qris-dots" />
            </div>
            <p className="muted" style={{ textAlign: "center", fontSize: "0.85rem" }}>
              Tunjukkan QRIS ke pelanggan. Setelah pelanggan bayar, tandai lunas.
            </p>
          </div>
        ) : (
          <p className="muted" style={{ padding: "0.75rem 0" }}>
            Konfirmasi pembayaran <strong>{method === "ewallet" ? "e-wallet" : "transfer"}</strong>{" "}
            sudah diterima, lalu tandai lunas.
          </p>
        )}

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button
            className="btn btn-primary"
            disabled={!canPay || busy}
            onClick={() => onConfirm(method, paid)}
          >
            {busy ? "Memproses…" : method === "tunai" ? "Bayar" : "Tandai Lunas"}
          </button>
        </div>
      </div>
    </div>
  );
}
