import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import * as analyticsApi from "../api/analytics";
import { formatRupiah } from "../lib/format";
import { IconBox, IconCart, IconLayers, IconChart } from "../components/icons";
import type { AnalyticsDashboard } from "../types/analytics";

function formatDay(ymd: string): string {
  return new Date(`${ymd}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "owner";

  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    const t = setTimeout(() => {
      analyticsApi
        .getDashboard(14)
        .then(setData)
        .catch(() => setData(null))
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(t);
  }, [isAdmin]);

  const trend = data?.sales_trend ?? [];
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));
  const periodTotal = trend.reduce((s, t) => s + t.total, 0);
  const margin = data?.margin;

  return (
    <div className="stack">
      <div>
        <h1>Halo, {user?.name} 👋</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          {isAdmin ? "Ringkasan & analitik 14 hari terakhir." : "Ringkasan toko Anda."}
        </p>
      </div>

      {isAdmin && (
        <>
          <div className="stat-grid">
            <div className="card">
              <div className="stat-label">Penjualan 14 hari</div>
              <div className="stat-value money">{formatRupiah(periodTotal)}</div>
            </div>
            <div className="card">
              <div className="stat-label">Laba kotor</div>
              <div className="stat-value money">{formatRupiah(margin?.profit ?? 0)}</div>
            </div>
            <div className="card">
              <div className="stat-label">Margin</div>
              <div className="stat-value">{(margin?.margin_pct ?? 0).toFixed(1)}%</div>
            </div>
            <div className="card">
              <div className="stat-label">Perlu restok</div>
              <div className="stat-value">{data?.low_stock.length ?? 0}</div>
            </div>
          </div>

          <div className="report-cols">
            <div className="card" style={{ padding: 0 }}>
              <div className="card-head">Tren penjualan</div>
              {loading ? (
                <p className="muted report-empty">Memuat…</p>
              ) : trend.length === 0 ? (
                <p className="muted report-empty">Belum ada penjualan.</p>
              ) : (
                <table className="table">
                  <tbody>
                    {trend.map((t) => (
                      <tr key={t.date}>
                        <td>
                          {formatDay(t.date)}
                          <div className="bar">
                            <span style={{ width: `${(t.total / maxTrend) * 100}%` }} />
                          </div>
                        </td>
                        <td className="num money">{formatRupiah(t.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card" style={{ padding: 0 }}>
              <div className="card-head">Alert stok</div>
              {loading ? (
                <p className="muted report-empty">Memuat…</p>
              ) : (data?.low_stock.length ?? 0) === 0 ? (
                <p className="muted report-empty">Semua stok aman.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th className="num">Stok</th>
                      <th className="num">Perkiraan habis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.low_stock.map((a) => (
                      <tr key={a.product_id}>
                        <td>{a.name}</td>
                        <td className="num">
                          {a.quantity <= 5 ? (
                            <span className="chip chip-accent">{a.quantity}</span>
                          ) : (
                            a.quantity
                          )}
                        </td>
                        <td className="num muted">
                          {a.days_left == null ? "—" : `${Math.floor(a.days_left)} hari`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <hr className="tear" />
        </>
      )}

      <div>
        <h2 style={{ marginBottom: "0.85rem" }}>Aksi cepat</h2>
        <div className="quick-grid">
          <Link to="/products" className="quick">
            <span className="quick-ico">
              <IconBox />
            </span>
            Produk
          </Link>
          <Link to="/kasir" className="quick">
            <span className="quick-ico">
              <IconCart />
            </span>
            Mulai jualan
          </Link>
          <Link to="/stok" className="quick">
            <span className="quick-ico">
              <IconLayers />
            </span>
            Kelola stok
          </Link>
          {isAdmin ? (
            <Link to="/laporan" className="quick">
              <span className="quick-ico">
                <IconChart />
              </span>
              Laporan
            </Link>
          ) : (
            <span className="quick soon">
              <span className="quick-ico">
                <IconChart />
              </span>
              Laporan
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
