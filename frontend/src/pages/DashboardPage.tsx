import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <main style={{ fontFamily: "system-ui", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>MZ POS</h1>
        <button onClick={logout} style={logoutBtn}>
          Keluar
        </button>
      </header>

      <p>
        Selamat datang, <strong>{user?.name}</strong> ({user?.role}).
      </p>

      <nav style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <Link to="/products" style={navCard}>
          📦 Produk
        </Link>
      </nav>

      <p style={{ color: "#666", marginTop: 24 }}>
        Menu lain (transaksi, stok, laporan) menyusul pada milestone berikut.
      </p>
    </main>
  );
}

const logoutBtn: React.CSSProperties = {
  padding: "8px 14px",
  background: "#ef4444",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const navCard: React.CSSProperties = {
  display: "block",
  padding: "16px 24px",
  background: "#f1f5f9",
  borderRadius: 10,
  textDecoration: "none",
  color: "#1e293b",
  fontWeight: 500,
};
