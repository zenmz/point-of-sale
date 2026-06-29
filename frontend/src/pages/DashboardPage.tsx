import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { IconBox, IconCart, IconLayers, IconChart } from "../components/icons";

// Ringkasan masih placeholder; angka nyata menyusul (M1.8 Laporan).
const STATS = [
  { label: "Penjualan hari ini", value: "Rp 0" },
  { label: "Transaksi", value: "0" },
  { label: "Produk aktif", value: "—" },
  { label: "Stok menipis", value: "—" },
];

export function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="stack">
      <div>
        <h1>Halo, {user?.name} 👋</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Ringkasan toko Anda. Data transaksi muncul setelah modul kasir aktif.
        </p>
      </div>

      <div className="stat-grid">
        {STATS.map((s) => (
          <div key={s.label} className="card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      <hr className="tear" />

      <div>
        <h2 style={{ marginBottom: "0.85rem" }}>Aksi cepat</h2>
        <div className="quick-grid">
          <Link to="/products" className="quick">
            <span className="quick-ico">
              <IconBox />
            </span>
            Produk
          </Link>
          <span className="quick soon">
            <span className="quick-ico">
              <IconCart />
            </span>
            Mulai jualan
          </span>
          <span className="quick soon">
            <span className="quick-ico">
              <IconLayers />
            </span>
            Kelola stok
          </span>
          <span className="quick soon">
            <span className="quick-ico">
              <IconChart />
            </span>
            Laporan
          </span>
        </div>
      </div>
    </div>
  );
}
