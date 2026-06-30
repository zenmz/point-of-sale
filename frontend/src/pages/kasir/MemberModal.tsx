import { useEffect, useState, type FormEvent } from "react";
import * as customerApi from "../../api/customer";
import { searchCustomers } from "../../offline/customerCache";
import { useOnline } from "../../hooks/useOnline";
import { ApiError } from "../../api/client";
import type { Customer } from "../../types/customer";

// MemberModal: cari member (nama/telepon) atau daftar member baru saat transaksi.
export function MemberModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (c: Customer) => void;
}) {
  const online = useOnline();
  const [tab, setTab] = useState<"cari" | "baru">("cari");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "cari") return;
    const t = setTimeout(() => {
      searchCustomers(search)
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [search, tab]);

  async function register(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await customerApi.createCustomer({
        name: name.trim(),
        phone: phone.trim() || null,
      });
      onPick(c);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal mendaftar member");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2>Member</h2>
        <div className="seg" style={{ marginBottom: "0.75rem" }}>
          <button
            className={`seg-btn${tab === "cari" ? " active" : ""}`}
            onClick={() => setTab("cari")}
          >
            Cari
          </button>
          <button
            className={`seg-btn${tab === "baru" ? " active" : ""}`}
            onClick={() => setTab("baru")}
            disabled={!online}
            title={online ? "" : "Daftar member baru perlu online"}
          >
            Daftar baru
          </button>
        </div>

        {error && <p className="err-box">{error}</p>}

        {tab === "cari" ? (
          <>
            <input
              className="input"
              placeholder="Cari nama atau telepon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <div className="sync-list" style={{ marginTop: "0.5rem", maxHeight: "40vh" }}>
              {results.length === 0 ? (
                <p className="muted" style={{ padding: "0.5rem" }}>
                  Tidak ada member. Coba kata kunci lain atau daftar baru.
                </p>
              ) : (
                results.map((c) => (
                  <button key={c.id} className="pick-item" onClick={() => onPick(c)}>
                    <span className="pick-name">{c.name}</span>
                    <span className="pick-meta">
                      <span className="muted">{c.phone ?? "—"}</span>
                      <span className="chip chip-brand">{c.points} poin</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <form onSubmit={register}>
            <label className="field">
              Nama
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              Telepon (opsional)
              <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={busy || !name.trim()}
            >
              {busy ? "Menyimpan…" : "Daftar & pilih"}
            </button>
          </form>
        )}

        <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: "0.5rem" }}>
          Tutup
        </button>
      </div>
    </div>
  );
}
