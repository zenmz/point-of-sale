import { useCallback, useEffect, useState } from "react";
import * as customerApi from "../../api/customer";
import { ApiError } from "../../api/client";
import { useAuth } from "../../hooks/useAuth";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Customer, CustomerDetail } from "../../types/customer";

export function PelangganPage() {
  const { user } = useAuth();
  const canEdit = user?.role === "admin" || user?.role === "owner";

  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState<Customer | "new" | null>(null);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setItems(await customerApi.listCustomers(q));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pelanggan</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {items.length} member
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm("new")}>
          <IconPlus size={18} />
          Tambah Member
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: "1rem" }}>
          <input
            className="input"
            placeholder="Cari nama atau telepon…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {loading ? (
          <p className="muted" style={{ padding: "0 1rem 1rem" }}>
            Memuat…
          </p>
        ) : items.length === 0 ? (
          <p className="muted" style={{ padding: "0 1rem 1.5rem" }}>
            Belum ada member.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Telepon</th>
                <th className="num">Poin</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>{c.name}</td>
                  <td className="muted">{c.phone ?? "—"}</td>
                  <td className="num">
                    <span className="chip chip-brand">{c.points}</span>
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-link" onClick={() => setDetailId(c.id)}>
                      Rincian
                    </button>
                    {canEdit && (
                      <button className="btn-link" onClick={() => setForm(c)}>
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {detailId && (
        <DetailModal
          id={detailId}
          canEdit={canEdit}
          onClose={() => setDetailId(null)}
          onChanged={() => load(search)}
        />
      )}
      {form && (
        <FormModal
          customer={form === "new" ? null : form}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load(search);
          }}
        />
      )}
    </div>
  );
}

function DetailModal({
  id,
  canEdit,
  onClose,
  onChanged,
}: {
  id: string;
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [d, setD] = useState<CustomerDetail | null>(null);
  const [redeem, setRedeem] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setD(await customerApi.getCustomer(id));
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => reload().catch(() => setError("Gagal memuat")), 0);
    return () => clearTimeout(t);
  }, [reload]);

  async function doRedeem() {
    const pts = Math.max(0, Number(redeem));
    if (pts <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await customerApi.redeemPoints(id, pts, "tukar poin");
      setRedeem("");
      await reload();
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menukar poin");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!d ? (
          <p className="muted">Memuat…</p>
        ) : (
          <>
            <h2>{d.name}</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              {d.phone ?? "—"} · Saldo poin <strong>{d.points}</strong>
            </p>
            {error && <p className="err-box">{error}</p>}

            {canEdit && (
              <div className="row" style={{ gap: "0.5rem", margin: "0.5rem 0" }}>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={d.points}
                  placeholder="Tukar poin"
                  value={redeem}
                  onChange={(e) => setRedeem(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="btn btn-primary"
                  onClick={doRedeem}
                  disabled={busy || Number(redeem) <= 0 || Number(redeem) > d.points}
                >
                  Tukar
                </button>
              </div>
            )}

            <h3 style={{ marginBottom: 4 }}>Riwayat beli</h3>
            {d.purchases.length === 0 ? (
              <p className="muted">Belum ada pembelian.</p>
            ) : (
              <table className="table">
                <tbody>
                  {d.purchases.map((p) => (
                    <tr key={p.id}>
                      <td>Nota #{p.number}</td>
                      <td className="num money">{formatRupiah(p.total)}</td>
                      <td className="num muted">+{p.points_earned} poin</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <h3 style={{ marginBottom: 4, marginTop: "0.75rem" }}>Riwayat poin</h3>
            {d.loyalty.length === 0 ? (
              <p className="muted">Belum ada mutasi poin.</p>
            ) : (
              <table className="table">
                <tbody>
                  {d.loyalty.map((e) => (
                    <tr key={e.id}>
                      <td>{e.type}</td>
                      <td className={`num${e.points < 0 ? " danger" : ""}`}>
                        {e.points > 0 ? "+" : ""}
                        {e.points}
                      </td>
                      <td className="num muted">saldo {e.balance_after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <button className="btn btn-ghost btn-block" onClick={onClose} style={{ marginTop: 8 }}>
              Tutup
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FormModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      };
      if (customer) await customerApi.updateCustomer(customer.id, input);
      else await customerApi.createCustomer(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{customer ? "Edit Member" : "Tambah Member"}</h2>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Nama
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Telepon (opsional)
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="field">
          Email (opsional)
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !name.trim()}>
            {busy ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </form>
    </div>
  );
}
