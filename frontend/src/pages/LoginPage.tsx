import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";

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
    <div className="auth-wrap">
      <form onSubmit={onSubmit} className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">MZ</div>
          <h1>POS</h1>
        </div>
        <p className="auth-sub">Masuk ke akun Anda</p>

        {error && <p className="err-box">{error}</p>}

        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
          style={{ justifyContent: "center" }}
        >
          {busy ? "Memproses…" : "Masuk"}
        </button>

        <p className="auth-foot">
          Belum ada akun? <Link to="/register">Daftar admin pertama</Link>
        </p>
      </form>
    </div>
  );
}
