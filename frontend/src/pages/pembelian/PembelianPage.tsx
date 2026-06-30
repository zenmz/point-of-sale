import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as purchaseApi from "../../api/purchase";
import * as catalogApi from "../../api/catalog";
import { ApiError } from "../../api/client";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Debt, PO, Supplier } from "../../types/purchase";
import type { Product } from "../../types/catalog";

const STATUS_CHIP: Record<string, string> = {
  dipesan: "chip-accent",
  diterima: "chip-brand",
  batal: "offline-chip",
};

export function PembelianPage() {
  const [tab, setTab] = useState<"po" | "supplier">("po");
  const [pos, setPos] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [debt, setDebt] = useState<Debt>({ total: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [poForm, setPoForm] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const [supForm, setSupForm] = useState<Supplier | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, d] = await Promise.all([
        purchaseApi.listPOs(),
        purchaseApi.listSuppliers(),
        purchaseApi.getDebt(),
      ]);
      setPos(p);
      setSuppliers(s);
      setDebt(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Pembelian</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Pesanan ke pemasok & penerimaan barang.
          </p>
        </div>
        {tab === "po" ? (
          <button className="btn btn-primary" onClick={() => setPoForm(true)}>
            <IconPlus size={18} />
            Buat PO
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setSupForm("new")}>
            <IconPlus size={18} />
            Tambah Pemasok
          </button>
        )}
      </div>

      {debt.count > 0 && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--accent)" }}>
          <strong>Hutang berjalan:</strong> {formatRupiah(debt.total)} dari {debt.count} PO belum
          lunas.
        </div>
      )}

      <div className="seg" style={{ marginBottom: "1rem", maxWidth: 280 }}>
        <button className={`seg-btn${tab === "po" ? " active" : ""}`} onClick={() => setTab("po")}>
          Pesanan
        </button>
        <button
          className={`seg-btn${tab === "supplier" ? " active" : ""}`}
          onClick={() => setTab("supplier")}
        >
          Pemasok
        </button>
      </div>

      {loading ? (
        <p className="muted">Memuat…</p>
      ) : tab === "po" ? (
        <div className="card" style={{ padding: 0 }}>
          {pos.length === 0 ? (
            <p className="muted" style={{ padding: "1rem" }}>
              Belum ada PO. Klik <strong>Buat PO</strong> untuk memesan barang.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>No</th>
                  <th>Pemasok</th>
                  <th className="num">Total</th>
                  <th className="center">Status</th>
                  <th className="center">Bayar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po.id}>
                    <td style={{ fontWeight: 500 }}>#{po.number}</td>
                    <td>{po.supplier_name ?? "—"}</td>
                    <td className="num money">{formatRupiah(po.total)}</td>
                    <td className="center">
                      <span className={`chip ${STATUS_CHIP[po.status]}`}>{po.status}</span>
                    </td>
                    <td className="center">
                      {po.status === "diterima" &&
                        (po.is_paid ? (
                          <span className="chip chip-brand">lunas</span>
                        ) : (
                          <span className="chip offline-chip">hutang</span>
                        ))}
                    </td>
                    <td className="num">
                      <button className="btn-link" onClick={() => setDetail(po.id)}>
                        Rincian
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {suppliers.length === 0 ? (
            <p className="muted" style={{ padding: "1rem" }}>
              Belum ada pemasok.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Telepon</th>
                  <th>Alamat</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 500 }}>{s.name}</td>
                    <td className="muted">{s.phone ?? "—"}</td>
                    <td className="muted">{s.address ?? "—"}</td>
                    <td className="num">
                      <button className="btn-link" onClick={() => setSupForm(s)}>
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {poForm && (
        <POForm
          suppliers={suppliers}
          onClose={() => setPoForm(false)}
          onSaved={() => {
            setPoForm(false);
            load();
          }}
        />
      )}
      {detail && (
        <PODetail
          id={detail}
          onClose={() => setDetail(null)}
          onChanged={load}
        />
      )}
      {supForm && (
        <SupplierForm
          supplier={supForm === "new" ? null : supForm}
          onClose={() => setSupForm(null)}
          onSaved={() => {
            setSupForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

interface Draft {
  product_id: string;
  qty: number;
  cost: number;
}

function POForm({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    catalogApi
      .listProducts("")
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  const total = lines.reduce((sum, l) => sum + l.qty * l.cost, 0);

  function addLine() {
    if (products.length === 0) return;
    setLines((ls) => [...ls, { product_id: products[0].id, qty: 1, cost: 0 }]);
  }
  function patch(i: number, p: Partial<Draft>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  }
  function remove(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (lines.length === 0) {
      setError("Tambahkan minimal 1 item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await purchaseApi.createPO({
        supplier_id: supplierId || undefined,
        note: note.trim() || undefined,
        items: lines.map((l) => ({ product_id: l.product_id, qty: l.qty, cost: l.cost })),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal membuat PO");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Buat Pesanan Pembelian</h2>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Pemasok (opsional)
          <select className="input" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">— tanpa pemasok —</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <div className="sync-list" style={{ maxHeight: "40vh" }}>
          {lines.length === 0 ? (
            <p className="muted" style={{ padding: "0.5rem" }}>
              Belum ada item.
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="num">Qty</th>
                  <th className="num">Harga beli</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <select
                        className="input"
                        value={l.product_id}
                        onChange={(e) => patch(i, { product_id: e.target.value })}
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="num">
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={l.qty}
                        style={{ width: 70, textAlign: "right" }}
                        onChange={(e) => patch(i, { qty: Math.max(1, Number(e.target.value)) })}
                      />
                    </td>
                    <td className="num">
                      <input
                        className="input"
                        type="number"
                        min={0}
                        value={l.cost}
                        style={{ width: 100, textAlign: "right" }}
                        onChange={(e) => patch(i, { cost: Math.max(0, Number(e.target.value)) })}
                      />
                    </td>
                    <td className="num">
                      <button type="button" className="btn-link danger" onClick={() => remove(i)}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={addLine}>
          + Tambah item
        </button>

        <label className="field" style={{ marginTop: "0.5rem" }}>
          Catatan (opsional)
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="pay-total" style={{ marginTop: "0.5rem" }}>
          <span className="muted">Total beli</span>
          <span className="money">{formatRupiah(total)}</span>
        </div>

        <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.5rem" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || lines.length === 0}>
            {busy ? "Menyimpan…" : "Buat PO"}
          </button>
        </div>
      </form>
    </div>
  );
}

function PODetail({
  id,
  onClose,
  onChanged,
}: {
  id: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [po, setPo] = useState<PO | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setPo(await purchaseApi.getPO(id));
  }, [id]);

  useEffect(() => {
    const t = setTimeout(() => reload().catch(() => setError("Gagal memuat")), 0);
    return () => clearTimeout(t);
  }, [reload]);

  async function act(fn: () => Promise<PO>) {
    setBusy(true);
    setError(null);
    try {
      setPo(await fn());
      onChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {!po ? (
          <p className="muted">Memuat…</p>
        ) : (
          <>
            <h2>PO #{po.number}</h2>
            <p className="muted" style={{ marginTop: -4 }}>
              {po.supplier_name ?? "Tanpa pemasok"} · {po.status}
              {po.status === "diterima" && (po.is_paid ? " · lunas" : " · hutang")}
            </p>
            {error && <p className="err-box">{error}</p>}
            <table className="table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th className="num">Qty</th>
                  <th className="num">Harga</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {po.items?.map((it) => (
                  <tr key={it.id}>
                    <td>{it.name}</td>
                    <td className="num">{it.qty}</td>
                    <td className="num money">{formatRupiah(it.cost)}</td>
                    <td className="num money">{formatRupiah(it.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pay-total">
              <span className="muted">Total</span>
              <span className="money">{formatRupiah(po.total)}</span>
            </div>

            <div className="row" style={{ justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Tutup
              </button>
              {po.status === "dipesan" && (
                <>
                  <button
                    className="btn btn-ghost danger"
                    disabled={busy}
                    onClick={() => act(() => purchaseApi.cancelPO(id))}
                  >
                    Batalkan
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={busy}
                    onClick={() => act(() => purchaseApi.receivePO(id))}
                  >
                    Terima barang
                  </button>
                </>
              )}
              {po.status === "diterima" && !po.is_paid && (
                <button
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => act(() => purchaseApi.payPO(id))}
                >
                  Tandai lunas
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SupplierForm({
  supplier,
  onClose,
  onSaved,
}: {
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input = {
        name: name.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
      };
      if (supplier) await purchaseApi.updateSupplier(supplier.id, input);
      else await purchaseApi.createSupplier(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{supplier ? "Edit Pemasok" : "Tambah Pemasok"}</h2>
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
          Alamat (opsional)
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
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
