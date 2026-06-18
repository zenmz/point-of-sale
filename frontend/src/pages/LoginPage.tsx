import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { wrap, card, label, input, button, errBox } from "./authStyles";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <h1>MZ POS</h1>
        <p style={{ color: "#666", marginTop: 0 }}>Masuk ke akun Anda</p>

        {error && <p style={errBox}>{error}</p>}

        <label style={label}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={input}
          />
        </label>
        <label style={label}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={input}
          />
        </label>

        <button type="submit" disabled={busy} style={button}>
          {busy ? "Memproses…" : "Masuk"}
        </button>

        <p style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
          Belum ada akun? <Link to="/register">Daftar admin pertama</Link>
        </p>
      </form>
    </div>
  );
}
