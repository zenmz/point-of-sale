import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../api/client";
import { wrap, card, label, input, button, errBox } from "./authStyles";

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
    <div style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <h1>MZ POS</h1>
        <p style={{ color: "#666", marginTop: 0 }}>Daftar admin & toko pertama</p>

        {error && <p style={errBox}>{error}</p>}

        <label style={label}>
          Nama Toko
          <input value={form.store_name} onChange={set("store_name")} required style={input} />
        </label>
        <label style={label}>
          Nama Admin
          <input value={form.name} onChange={set("name")} required style={input} />
        </label>
        <label style={label}>
          Email
          <input type="email" value={form.email} onChange={set("email")} required style={input} />
        </label>
        <label style={label}>
          Password
          <input
            type="password"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
            style={input}
          />
        </label>

        <button type="submit" disabled={busy} style={button}>
          {busy ? "Memproses…" : "Daftar"}
        </button>

        <p style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
          Sudah punya akun? <Link to="/login">Masuk</Link>
        </p>
      </form>
    </div>
  );
}
