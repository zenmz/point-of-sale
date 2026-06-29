import { useEffect, useState, type FormEvent } from "react";
import * as shiftApi from "../api/shift";
import { ApiError } from "../api/client";
import { formatRupiah } from "../lib/format";
import type { Shift, ShiftSummary } from "../types/shift";

export function ShiftWidget() {
  const [shift, setShift] = useState<Shift | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "open" | "close">(null);

  useEffect(() => {
    shiftApi
      .getCurrentShift()
      .then(setShift)
      .catch(() => setShift(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  return (
    <>
      {shift ? (
        <button className="chip chip-brand shift-chip" onClick={() => setModal("close")}>
          <span className="chip-dot" />
          Shift buka · {formatRupiah(shift.summary?.total_sales ?? 0)}
        </button>
      ) : (
        <button className="chip chip-accent shift-chip" onClick={() => setModal("open")}>
          <span className="chip-dot" />
          Buka shift
        </button>
      )}

      {modal === "open" && (
        <OpenShiftModal
          onClose={() => setModal(null)}
          onDone={(s) => {
            setShift(s);
            setModal(null);
          }}
        />
      )}
      {modal === "close" && shift && (
        <CloseShiftModal
          shift={shift}
          onClose={() => setModal(null)}
          onDone={() => {
            setShift(null);
            setModal(null);
          }}
        />
      )}
    </>
  );
}

function OpenShiftModal({ onClose, onDone }: { onClose: () => void; onDone: (s: Shift) => void }) {
  const [cash, setCash] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onDone(await shiftApi.openShift(cash, note.trim() || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuka shift");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Buka Shift</h2>
        <p className="muted" style={{ marginTop: -4 }}>
          Masukkan kas awal (modal laci) untuk memulai.
        </p>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Kas awal (Rp)
          <input
            className="input"
            type="number"
            min={0}
            value={cash}
            onChange={(e) => setCash(Math.max(0, Number(e.target.value)))}
            autoFocus
          />
        </label>
        <label className="field">
          Catatan (opsional)
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Membuka…" : "Buka Shift"}
          </button>
        </div>
      </form>
    </div>
  );
}

function CloseShiftModal({
  shift,
  onClose,
  onDone,
}: {
  shift: Shift;
  onClose: () => void;
  onDone: () => void;
}) {
  // Muat ulang shift untuk rekap terbaru.
  const [current, setCurrent] = useState<Shift>(shift);
  const [closed, setClosed] = useState<Shift | null>(null);
  const [cash, setCash] = useState<number>(shift.summary?.expected_cash ?? 0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shiftApi.getCurrentShift().then((s) => {
      if (s) {
        setCurrent(s);
        setCash(s.summary?.expected_cash ?? 0);
      }
    });
  }, []);

  const sum = current.summary;
  const preview = cash - (sum?.expected_cash ?? 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setClosed(await shiftApi.closeShift(cash, note.trim() || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menutup shift");
      setBusy(false);
    }
  }

  if (closed) {
    const cs = closed.summary;
    return (
      <div className="overlay" onClick={onDone}>
        <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
          <h2>Shift Ditutup</h2>
          <RekapList
            summary={cs}
            openingCash={closed.opening_cash}
            closingCash={closed.closing_cash}
          />
          <button className="btn btn-primary btn-block" onClick={onDone}>
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Tutup Shift</h2>
        {error && <p className="err-box">{error}</p>}

        <RekapList summary={sum} openingCash={current.opening_cash} closingCash={null} />

        <label className="field">
          Kas akhir dihitung (Rp)
          <input
            className="input"
            type="number"
            min={0}
            value={cash}
            onChange={(e) => setCash(Math.max(0, Number(e.target.value)))}
            autoFocus
          />
        </label>
        <div className={`pay-change${preview < 0 ? " bad" : ""}`}>
          <span>Selisih</span>
          <span className="money">
            {preview > 0 ? "+" : ""}
            {formatRupiah(preview)}
          </span>
        </div>
        <label className="field">
          Catatan (opsional)
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Menutup…" : "Tutup Shift"}
          </button>
        </div>
      </form>
    </div>
  );
}

function RekapList({
  summary,
  openingCash,
  closingCash,
}: {
  summary?: ShiftSummary;
  openingCash: number;
  closingCash: number | null;
}) {
  if (!summary) return null;
  return (
    <dl className="totals" style={{ marginBottom: "0.75rem" }}>
      <div>
        <dt>Transaksi</dt>
        <dd>{summary.tx_count}</dd>
      </div>
      <div>
        <dt>Penjualan tunai</dt>
        <dd className="money">{formatRupiah(summary.cash_sales)}</dd>
      </div>
      <div>
        <dt>Penjualan non-tunai</dt>
        <dd className="money">{formatRupiah(summary.noncash_sales)}</dd>
      </div>
      <div>
        <dt>Kas awal</dt>
        <dd className="money">{formatRupiah(openingCash)}</dd>
      </div>
      <div className="totals-grand">
        <dt>Kas seharusnya</dt>
        <dd className="money">{formatRupiah(summary.expected_cash)}</dd>
      </div>
      {closingCash !== null && (
        <>
          <div>
            <dt>Kas akhir</dt>
            <dd className="money">{formatRupiah(closingCash)}</dd>
          </div>
          <div>
            <dt>Selisih</dt>
            <dd className={`money${summary.difference < 0 ? " danger" : ""}`}>
              {summary.difference > 0 ? "+" : ""}
              {formatRupiah(summary.difference)}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}
