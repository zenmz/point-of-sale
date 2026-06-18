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
      <p style={{ color: "#666" }}>
        Dashboard akan diisi fitur kasir & admin pada milestone berikut.
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
