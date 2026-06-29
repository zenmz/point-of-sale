import { useCallback, useEffect, useMemo, useState } from "react";
import * as catalogApi from "../../api/catalog";
import * as txApi from "../../api/transaction";
import { ApiError } from "../../api/client";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Product } from "../../types/catalog";
import type { PaymentMethod, Transaction } from "../../types/transaction";
import { computeTotals, lineTotal, newLine, type CartLine } from "./cart";
import { PaymentModal } from "./PaymentModal";

const METHOD_LABEL: Record<PaymentMethod, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  ewallet: "E-Wallet",
  transfer: "Transfer",
};

export function KasirPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [notaDiscount, setNotaDiscount] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [servicePercent, setServicePercent] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Transaction | null>(null);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setProducts(await catalogApi.listProducts(q));
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
    setNotaDiscount(0);
    setError(null);
    setDone(null);
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
    try {
      const tx = await txApi.checkout({
        items: cart.map((l) => ({ product_id: l.product_id, qty: l.qty, discount: l.discount })),
        discount: notaDiscount,
        tax_percent: taxPercent,
        service_percent: servicePercent,
        method,
        paid_amount: paidAmount,
      });
      setPaying(false);
      setDone(tx);
      setCart([]);
      setNotaDiscount(0);
      load(search); // segarkan stok
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan transaksi");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <SaleSuccess tx={done} onNew={resetSale} />;
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
          <div className="totals-grand">
            <dt>Total</dt>
            <dd className="money">{formatRupiah(totals.total)}</dd>
          </div>
        </dl>

        <button
          className="btn btn-primary btn-block"
          disabled={cart.length === 0 || busy}
          onClick={openPayment}
        >
          <IconPlus size={18} />
          {`Bayar ${formatRupiah(totals.total)}`}
        </button>
      </section>

      {paying && (
        <PaymentModal
          total={totals.total}
          busy={busy}
          error={error}
          onClose={() => setPaying(false)}
          onConfirm={onPay}
        />
      )}
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

        <p className="muted" style={{ fontSize: "0.82rem", marginTop: "0.5rem" }}>
          Struk menyusul di modul berikutnya.
        </p>

        <button className="btn btn-primary btn-block" onClick={onNew}>
          Transaksi baru
        </button>
      </div>
    </div>
  );
}
