import { useState } from "react";
import { useSync } from "../hooks/useSync";
import { listPending } from "../offline/txQueue";
import type { PendingTx } from "../offline/db";
import { formatRupiah } from "../lib/format";

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// SyncWidget: indikator status sinkronisasi di topbar + panel rincian antrian.
export function SyncWidget() {
  const { pending, errors, syncing, sync, retry } = useSync();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<PendingTx[]>([]);

  if (pending === 0 && errors === 0 && !syncing) return null;

  async function openPanel() {
    setItems(await listPending());
    setOpen(true);
  }

  async function onSync() {
    await sync();
    setItems(await listPending());
  }

  async function onRetry() {
    await retry();
    setItems(await listPending());
  }

  const chip = syncing
    ? { cls: "chip-brand", text: "Menyinkron…" }
    : errors > 0
      ? { cls: "offline-chip", text: `${errors} konflik` }
      : { cls: "chip-accent", text: `${pending} tertunda` };

  return (
    <>
      <button className={`chip ${chip.cls} shift-chip`} onClick={openPanel}>
        <span className="chip-dot" />
        {chip.text}
      </button>

      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <h2>Sinkronisasi</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              {pending} menunggu · {errors} konflik
            </p>

            {items.length === 0 ? (
              <p className="muted">Antrian kosong.</p>
            ) : (
              <div className="sync-list">
                {items.map((it) => (
                  <div key={it.client_id} className="sync-item">
                    <div>
                      <strong className="money">{formatRupiah(it.total)}</strong>
                      <div className="muted" style={{ fontSize: "0.78rem" }}>
                        {formatWhen(it.created_at)} · {it.payload.method}
                      </div>
                      {it.status === "error" && it.error && (
                        <div className="danger" style={{ fontSize: "0.8rem" }}>
                          {it.error}
                        </div>
                      )}
                    </div>
                    <span
                      className={`chip ${it.status === "error" ? "offline-chip" : "chip-accent"}`}
                    >
                      {it.status === "error" ? "konflik" : "tertunda"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                Tutup
              </button>
              {errors > 0 && (
                <button className="btn btn-ghost" onClick={onRetry} disabled={syncing}>
                  Coba lagi konflik
                </button>
              )}
              <button className="btn btn-primary" onClick={onSync} disabled={syncing}>
                {syncing ? "Menyinkron…" : "Sinkron sekarang"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
