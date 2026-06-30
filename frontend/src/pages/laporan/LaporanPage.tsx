import { useCallback, useEffect, useState } from "react";
import * as reportApi from "../../api/report";
import * as storeApi from "../../api/store";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { formatRupiah } from "../../lib/format";
import type { PaymentBreakdown, SalesReport, TopProduct } from "../../types/report";
import type { Store } from "../../types/store";

const METHOD_LABEL: Record<string, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  ewallet: "E-Wallet",
  transfer: "Transfer",
};

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toYMD(d);
}

function formatDay(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const PRESETS = [
  { label: "Hari ini", from: () => toYMD(new Date()), to: () => toYMD(new Date()) },
  { label: "7 hari", from: () => daysAgo(6), to: () => toYMD(new Date()) },
  { label: "30 hari", from: () => daysAgo(29), to: () => toYMD(new Date()) },
];

export function LaporanPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "owner";

  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(toYMD(new Date()));
  const [storeFilter, setStoreFilter] = useState(""); // "" = semua cabang
  const [stores, setStores] = useState<Store[]>([]);
  const [sales, setSales] = useState<SalesReport | null>(null);
  const [top, setTop] = useState<TopProduct[]>([]);
  const [pay, setPay] = useState<PaymentBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOwner) return;
    storeApi
      .listStores()
      .then(setStores)
      .catch(() => setStores([]));
  }, [isOwner]);

  const load = useCallback(async (f: string, t: string, store: string) => {
    setLoading(true);
    setError(null);
    try {
      const sid = store || undefined;
      const [s, tp, pm] = await Promise.all([
        reportApi.salesReport(f, t, sid),
        reportApi.topProducts(f, t, sid),
        reportApi.paymentMethods(f, t, sid),
      ]);
      setSales(s);
      setTop(tp);
      setPay(pm);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memuat laporan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(from, to, storeFilter), 150);
    return () => clearTimeout(t);
  }, [from, to, storeFilter, load]);

  const maxDaily = Math.max(1, ...(sales?.daily.map((d) => d.total) ?? [0]));
  const summary = sales?.summary;

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1>Laporan</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {isOwner && !storeFilter
              ? "Ringkasan penjualan gabungan semua cabang."
              : "Ringkasan penjualan & performa toko."}
          </p>
        </div>
      </div>

      <div className="card report-filter">
        {isOwner && (
          <label className="field">
            Cabang
            <select
              className="input"
              value={storeFilter}
              onChange={(e) => setStoreFilter(e.target.value)}
            >
              <option value="">Semua cabang</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="seg">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              className="seg-btn"
              onClick={() => {
                setFrom(p.from());
                setTo(p.to());
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="field">
          Dari
          <input
            className="input"
            type="date"
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="field">
          Sampai
          <input
            className="input"
            type="date"
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
      </div>

      {error && <p className="err-box">{error}</p>}

      {loading ? (
        <p className="muted">Memuat laporan…</p>
      ) : (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-label">Total penjualan</div>
              <div className="stat-value money">{formatRupiah(summary?.total_sales ?? 0)}</div>
            </div>
            <div className="card">
              <div className="stat-label">Transaksi</div>
              <div className="stat-value">{summary?.tx_count ?? 0}</div>
            </div>
            <div className="card">
              <div className="stat-label">Rata-rata / nota</div>
              <div className="stat-value money">{formatRupiah(summary?.avg_sale ?? 0)}</div>
            </div>
            <div className="card">
              <div className="stat-label">Total diskon</div>
              <div className="stat-value money">{formatRupiah(summary?.total_discount ?? 0)}</div>
            </div>
          </div>

          {isOwner && (sales?.by_store.length ?? 0) > 1 && (
            <div className="card" style={{ padding: 0 }}>
              <div className="card-head">Per cabang</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Cabang</th>
                    <th className="center">Transaksi</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales?.by_store.map((s) => (
                    <tr key={s.store_id}>
                      <td style={{ fontWeight: 500 }}>{s.store_name}</td>
                      <td className="center">{s.tx_count}</td>
                      <td className="num money">{formatRupiah(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="report-cols">
            <div className="card" style={{ padding: 0 }}>
              <div className="card-head">Penjualan harian</div>
              {sales && sales.daily.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th className="center">Transaksi</th>
                      <th className="num">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.daily.map((d) => (
                      <tr key={d.date}>
                        <td>
                          {formatDay(d.date)}
                          <div className="bar">
                            <span style={{ width: `${(d.total / maxDaily) * 100}%` }} />
                          </div>
                        </td>
                        <td className="center">{d.tx_count}</td>
                        <td className="num money">{formatRupiah(d.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="muted report-empty">Belum ada penjualan pada rentang ini.</p>
              )}
            </div>

            <div className="stack">
              <div className="card" style={{ padding: 0 }}>
                <div className="card-head">Metode bayar</div>
                {pay.length > 0 ? (
                  <table className="table">
                    <tbody>
                      {pay.map((p) => (
                        <tr key={p.method}>
                          <td>{METHOD_LABEL[p.method] ?? p.method}</td>
                          <td className="center muted">{p.count}×</td>
                          <td className="num money">{formatRupiah(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted report-empty">—</p>
                )}
              </div>

              <div className="card" style={{ padding: 0 }}>
                <div className="card-head">Produk terlaris</div>
                {top.length > 0 ? (
                  <table className="table">
                    <tbody>
                      {top.map((p, i) => (
                        <tr key={(p.product_id ?? "") + p.name}>
                          <td>
                            <span className="muted">{i + 1}.</span> {p.name}
                          </td>
                          <td className="center">{p.qty_sold}</td>
                          <td className="num money">{formatRupiah(p.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="muted report-empty">—</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
