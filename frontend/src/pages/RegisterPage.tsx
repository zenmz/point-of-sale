import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";

// Registrasi admin pertama + toko (bootstrap). Backend menolak bila sudah ada user.
export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ store_name: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(form);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mendaftar");
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
        <p className="auth-sub">Daftar admin &amp; toko pertama</p>

        {error && <p className="err-box">{error}</p>}

        <label className="field">
          Nama Toko
          <input className="input" value={form.store_name} onChange={set("store_name")} required />
        </label>
        <label className="field">
          Nama Admin
          <input className="input" value={form.name} onChange={set("name")} required />
        </label>
        <label className="field">
          Email
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={set("email")}
            required
          />
        </label>
        <label className="field">
          Password
          <input
            className="input"
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
          />
        </label>

        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
          style={{ justifyContent: "center" }}
        >
          {busy ? "Memproses…" : "Daftar"}
        </button>

        <p className="auth-foot">
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
      </form>
    </div>
  );
}
