import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as txApi from "../../api/transaction";
import * as promoApi from "../../api/promo";
import { ApiError } from "../../api/client";
import { loadProducts } from "../../offline/catalogCache";
import { enqueue, newClientId } from "../../offline/txQueue";
import { useOnline } from "../../hooks/useOnline";
import { useSync } from "../../hooks/useSync";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Product } from "../../types/catalog";
import type { PaymentMethod, Transaction } from "../../types/transaction";
import type { Customer } from "../../types/customer";
import { computeTotals, lineTotal, newLine, type CartLine } from "./cart";
import { PaymentModal } from "./PaymentModal";
import { MemberModal } from "./MemberModal";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  ewallet: "E-Wallet",
  transfer: "Transfer",
};

export function KasirPage() {
  const online = useOnline();
  const { pending, refresh: refreshSync, sync: syncNow } = useSync();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [member, setMember] = useState<Customer | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [promo, setPromo] = useState<{ discount: number; applied: string[] }>({
    discount: 0,
    applied: [],
  });
  const [notaDiscount, setNotaDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Transaction | null>(null);
  const [offlineSale, setOfflineSale] = useState<{ total: number; method: PaymentMethod } | null>(
    null,
  );
  const [paying, setPaying] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const { products } = await loadProducts(q);
      setProducts(products);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
  }, [search, load]);

  const totals = useMemo(
    () => computeTotals(cart, notaDiscount, taxPercent, servicePercent),
    [cart, notaDiscount, taxPercent, servicePercent],
  );

  // Pratinjau diskon promo otomatis (server otoritatif; di sini sekadar estimasi
  // tampilan). Hanya saat online — offline promo dihitung server ketika sinkron.
  useEffect(() => {
    const t = setTimeout(() => {
      if (!online || cart.length === 0) {
        setPromo({ discount: 0, applied: [] });
        return;
      }
      const items = cart.map((l) => ({ product_id: l.product_id, qty: l.qty }));
      promoApi
        .previewPromo(items)
        .then(setPromo)
        .catch(() => setPromo({ discount: 0, applied: [] }));
    }, 250);
    return () => clearTimeout(t);
  }, [cart, online]);

  // Bayar = total nota dikurangi estimasi promo (tak kurang dari 0).
  const payable = Math.max(0, totals.total - promo.discount);

  function addToCart(p: Product) {
    if (p.stock <= 0) return;
    setError(null);
    setCart((prev) => {
      const i = prev.findIndex((l) => l.product_id === p.id);
      if (i === -1) return [...prev, newLine(p)];
      return prev.map((l, idx) => (idx === i ? { ...l, qty: Math.min(l.qty + 1, l.stock) } : l));
    });
  }

  function patchLine(id: string, patch: Partial<CartLine>) {
    setCart((prev) => prev.map((l) => (l.product_id === id ? { ...l, ...patch } : l)));
  }

  function setQty(line: CartLine, qty: number) {
    const clamped = Math.max(1, Math.min(qty, line.stock));
    patchLine(line.product_id, { qty: clamped });
  }

  function removeLine(id: string) {
    setCart((prev) => prev.filter((l) => l.product_id !== id));
  }

  function resetSale() {
    setCart([]);
    setMember(null);
    setNotaDiscount(0);
    setError(null);
    setDone(null);
    setOfflineSale(null);
    setPaying(false);
  }

  function openPayment() {
    if (cart.length === 0) return;
    setError(null);
    setPaying(true);
  }

  async function onPay(method: PaymentMethod, paidAmount: number) {
    setBusy(true);
    setError(null);
    const payload = {
      items: cart.map((l) => ({ product_id: l.product_id, qty: l.qty, discount: l.discount })),
      discount: notaDiscount,
      tax_percent: taxPercent,
      service_percent: servicePercent,
      method,
      paid_amount: paidAmount,
      client_id: newClientId(),
      customer_id: member?.id,
    };

    // Online: kirim langsung. Error HTTP (mis. stok kurang) tampil ke kasir.
    if (online) {
      try {
        const tx = await txApi.checkout(payload);
        finishSale();
        setDone(tx);
        load(search); // segarkan stok
        return;
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
          setBusy(false);
          return;
        }
        // Jaringan putus saat bayar → jatuh ke antrian offline di bawah.
      }
    }

    // Offline: simpan ke antrian lokal (idempoten saat sinkron nanti).
    try {
      await enqueue(payload, totals.total);
      await refreshSync();
      void syncNow(); // coba kirim segera bila ternyata masih online
      finishSale();
      setOfflineSale({ total: totals.total, method });
    } catch {
      setError("Gagal menyimpan transaksi offline");
      setBusy(false);
    }
  }

  function finishSale() {
    setPaying(false);
    setBusy(false);
    setCart([]);
    setMember(null);
    setNotaDiscount(0);
  }

  if (done) {
    return <SaleSuccess tx={done} onNew={resetSale} />;
  }
  if (offlineSale) {
    return <OfflineSuccess sale={offlineSale} pending={pending} onNew={resetSale} />;
  }

  return (
    <div className="kasir">
      {/* Kiri: pemilih produk */}
      <section className="kasir-pick card" style={{ padding: 0 }}>
        <div style={{ padding: "1rem" }}>
          <input
            className="input"
            placeholder="Cari / scan produk (nama, SKU, barcode)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        <div className="pick-list">
          {loading ? (
            <p className="muted" style={{ padding: "0 1rem 1rem" }}>
              Memuat…
            </p>
          ) : products.length === 0 ? (
            <p className="muted" style={{ padding: "0 1rem 1rem" }}>
              Produk tidak ditemukan.
            </p>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                className="pick-item"
                onClick={() => addToCart(p)}
                disabled={p.stock <= 0}
              >
                <span className="pick-name">
                  {p.name}
                  {p.stock <= 0 && <span className="chip chip-accent">habis</span>}
                </span>
                <span className="pick-meta">
                  <span className="money">{formatRupiah(p.price)}</span>
                  <span className="muted">stok {p.stock}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* Kanan: keranjang */}
      <section className="kasir-cart card">
        <div className="between">
          <h2 style={{ margin: 0 }}>Keranjang</h2>
          {cart.length > 0 && (
            <button className="btn-link danger" onClick={() => setCart([])}>
              Kosongkan
            </button>
          )}
        </div>

        {!online && (
          <p className="offline-note">
            Mode offline — katalog dari cache. Transaksi disimpan & disinkron saat online.
          </p>
        )}
        {pending > 0 && (
          <p className="muted" style={{ fontSize: "0.82rem", margin: 0 }}>
            {pending} transaksi menunggu sinkronisasi.
          </p>
        )}
        {error && <p className="err-box">{error}</p>}

        {cart.length === 0 ? (
          <p className="muted" style={{ padding: "1.5rem 0" }}>
            Keranjang kosong. Pilih produk di sebelah kiri.
          </p>
        ) : (
          <div className="cart-lines">
            {cart.map((l) => (
              <div key={l.product_id} className="cart-line">
                <div className="cart-line-top">
                  <strong>{l.name}</strong>
                  <button
                    className="icon-x"
                    onClick={() => removeLine(l.product_id)}
                    aria-label="Hapus item"
                  >
                    ✕
                  </button>
                </div>
                <div className="muted" style={{ fontSize: "0.82rem" }}>
                  {formatRupiah(l.price)} / item · stok {l.stock}
                </div>
                <div className="cart-line-ctl">
                  <div className="qty">
                    <button onClick={() => setQty(l, l.qty - 1)} aria-label="Kurangi">
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={l.stock}
                      value={l.qty}
                      onChange={(e) => setQty(l, Number(e.target.value))}
                    />
                    <button onClick={() => setQty(l, l.qty + 1)} aria-label="Tambah">
                      +
                    </button>
                  </div>
                  <label className="disc">
                    Diskon
                    <input
                      type="number"
                      min={0}
                      value={l.discount}
                      onChange={(e) =>
                        patchLine(l.product_id, { discount: Math.max(0, Number(e.target.value)) })
                      }
                    />
                  </label>
                  <span className="cart-line-total money">{formatRupiah(lineTotal(l))}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <hr className="tear" />

        <div className="member-bar">
          {member ? (
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <span>
                👤 <strong>{member.name}</strong>{" "}
                <span className="chip chip-brand">{member.points} poin</span>
              </span>
              <button className="btn-link danger" onClick={() => setMember(null)}>
                Lepas
              </button>
            </div>
          ) : (
            <button className="btn-link" onClick={() => setMemberOpen(true)} disabled={!online}>
              + Tambahkan member {online ? "" : "(perlu online)"}
            </button>
          )}
        </div>

        <div className="cart-config">
          <label className="field">
            Diskon nota (Rp)
            <input
              className="input"
              type="number"
              min={0}
              value={notaDiscount}
              onChange={(e) => setNotaDiscount(Math.max(0, Number(e.target.value)))}
            />
          </label>
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              Pajak (%)
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={taxPercent}
                onChange={(e) => setTaxPercent(Math.max(0, Number(e.target.value)))}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Service (%)
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={servicePercent}
                onChange={(e) => setServicePercent(Math.max(0, Number(e.target.value)))}
              />
            </label>
          </div>
        </div>

        <dl className="totals">
          <div>
            <dt>Subtotal</dt>
            <dd className="money">{formatRupiah(totals.subtotal)}</dd>
          </div>
          {totals.discount > 0 && (
            <div>
              <dt>Diskon nota</dt>
              <dd className="money danger">−{formatRupiah(totals.discount)}</dd>
            </div>
          )}
          {totals.tax > 0 && (
            <div>
              <dt>Pajak ({taxPercent}%)</dt>
              <dd className="money">{formatRupiah(totals.tax)}</dd>
            </div>
          )}
          {totals.service > 0 && (
            <div>
              <dt>Service ({servicePercent}%)</dt>
              <dd className="money">{formatRupiah(totals.service)}</dd>
            </div>
          )}
          {promo.discount > 0 && (
            <div>
              <dt>Promo{promo.applied.length > 0 ? ` (${promo.applied.join(", ")})` : ""}</dt>
              <dd className="money danger">−{formatRupiah(promo.discount)}</dd>
            </div>
          )}
          <div className="totals-grand">
            <dt>Total</dt>
            <dd className="money">{formatRupiah(payable)}</dd>
          </div>
        </dl>

        <button
          className="btn btn-primary btn-block"
          disabled={cart.length === 0 || busy}
          onClick={openPayment}
        >
          <IconPlus size={18} />
          {`Bayar ${formatRupiah(payable)}`}
        </button>
      </section>

      {paying && (
        <PaymentModal
          total={payable}
          busy={busy}
          error={error}
          onClose={() => setPaying(false)}
          onConfirm={onPay}
        />
      )}

      {memberOpen && (
        <MemberModal
          onClose={() => setMemberOpen(false)}
          onPick={(c) => {
            setMember(c);
            setMemberOpen(false);
          }}
        />
      )}
    </div>
  );
}

function OfflineSuccess({
  sale,
  pending,
  onNew,
}: {
  sale: { total: number; method: PaymentMethod };
  pending: number;
  onNew: () => void;
}) {
  return (
    <div className="sale-done">
      <div className="card sale-done-card">
        <div className="sale-done-check offline">⤓</div>
        <h1>Tersimpan offline</h1>
        <p className="muted">Akan disinkron otomatis saat online</p>

        <dl className="totals" style={{ marginTop: "1rem" }}>
          <div className="totals-grand">
            <dt>Total</dt>
            <dd className="money">{formatRupiah(sale.total)}</dd>
          </div>
          <div>
            <dt>Metode</dt>
            <dd>{METHOD_LABEL[sale.method]}</dd>
          </div>
          <div>
            <dt>Menunggu sinkron</dt>
            <dd>{pending}</dd>
          </div>
        </dl>

        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
          Nota & struk terbit setelah transaksi tersinkron ke server.
        </p>

        <button className="btn btn-primary btn-block" onClick={onNew}>
          Transaksi baru
        </button>
      </div>
    </div>
  );
}

function SaleSuccess({ tx, onNew }: { tx: Transaction; onNew: () => void }) {
  return (
    <div className="sale-done">
      <div className="card sale-done-card">
        <div className="sale-done-check">✓</div>
        <h1>Transaksi tersimpan</h1>
        <p className="muted">Nota #{tx.number}</p>

        <dl className="totals" style={{ marginTop: "1rem" }}>
          <div>
            <dt>Subtotal</dt>
            <dd className="money">{formatRupiah(tx.subtotal)}</dd>
          </div>
          {tx.discount > 0 && (
            <div>
              <dt>Diskon</dt>
              <dd className="money danger">−{formatRupiah(tx.discount)}</dd>
            </div>
          )}
          {tx.tax > 0 && (
            <div>
              <dt>Pajak</dt>
              <dd className="money">{formatRupiah(tx.tax)}</dd>
            </div>
          )}
          {tx.service_charge > 0 && (
            <div>
              <dt>Service</dt>
              <dd className="money">{formatRupiah(tx.service_charge)}</dd>
            </div>
          )}
          <div className="totals-grand">
            <dt>Total</dt>
            <dd className="money">{formatRupiah(tx.total)}</dd>
          </div>
          {tx.customer_name && (
            <div>
              <dt>Member</dt>
              <dd>
                {tx.customer_name}
                {tx.points_earned > 0 && (
                  <span className="chip chip-brand" style={{ marginLeft: 6 }}>
                    +{tx.points_earned} poin
                  </span>
                )}
              </dd>
            </div>
          )}
          {tx.payment && (
            <>
              <div>
                <dt>Bayar ({METHOD_LABEL[tx.payment.method]})</dt>
                <dd className="money">{formatRupiah(tx.payment.amount)}</dd>
              </div>
              {tx.payment.change > 0 && (
                <div>
                  <dt>Kembalian</dt>
                  <dd className="money">{formatRupiah(tx.payment.change)}</dd>
                </div>
              )}
            </>
          )}
        </dl>

        <Link to={`/struk/${tx.id}`} className="btn btn-ghost btn-block">
          Lihat / cetak struk
        </Link>
        <button
          className="btn btn-primary btn-block"
          onClick={onNew}
          style={{ marginTop: "0.6rem" }}
        >
          Transaksi baru
        </button>
      </div>
    </div>
  );
}
