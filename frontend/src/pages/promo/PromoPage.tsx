import { useCallback, useEffect, useState, type FormEvent } from "react";
import * as promoApi from "../../api/promo";
import * as catalogApi from "../../api/catalog";
import { ApiError } from "../../api/client";
import { formatRupiah } from "../../lib/format";
import { IconPlus } from "../../components/icons";
import type { Promotion, PromoType } from "../../types/promo";
import type { Product } from "../../types/catalog";

const TYPE_LABEL: Record<PromoType, string> = {
  nota_percent: "Diskon nota",
  product_qty: "Diskon qty produk",
  happy_hour: "Happy hour",
};

function describe(p: Promotion): string {
  switch (p.type) {
    case "nota_percent":
      return `${p.percent}% bila belanja ≥ ${formatRupiah(p.min_purchase)}`;
    case "product_qty":
      return `${p.percent}% bila beli ≥ ${p.min_qty} item`;
    case "happy_hour":
      return `${p.percent}% jam ${p.start_hour}:00–${p.end_hour}:00`;
  }
}

export function PromoPage() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Promotion | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, prods] = await Promise.all([promoApi.listPromotions(), catalogApi.listProducts("")]);
      setItems(ps);
      setProducts(prods);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  function productName(id: string | null) {
    return products.find((p) => p.id === id)?.name ?? "—";
  }

  async function onDelete(p: Promotion) {
    if (!confirm(`Hapus promo "${p.name}"?`)) return;
    await promoApi.deletePromotion(p.id);
    load();
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Promo</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Diskon otomatis diterapkan saat checkout.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setForm("new")}>
          <IconPlus size={18} />
          Buat Promo
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <p className="muted" style={{ padding: "1rem" }}>
            Memuat…
          </p>
        ) : items.length === 0 ? (
          <p className="muted" style={{ padding: "1rem" }}>
            Belum ada promo.
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Aturan</th>
                <th className="center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>{TYPE_LABEL[p.type]}</td>
                  <td className="muted">
                    {describe(p)}
                    {p.type === "product_qty" && ` · ${productName(p.product_id)}`}
                  </td>
                  <td className="center">
                    {p.is_active ? (
                      <span className="chip chip-brand">aktif</span>
                    ) : (
                      <span className="chip chip-accent">nonaktif</span>
                    )}
                  </td>
                  <td className="num" style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-link" onClick={() => setForm(p)}>
                      Edit
                    </button>
                    <button className="btn-link danger" onClick={() => onDelete(p)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {form && (
        <PromoForm
          promo={form === "new" ? null : form}
          products={products}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PromoForm({
  promo,
  products,
  onClose,
  onSaved,
}: {
  promo: Promotion | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(promo?.name ?? "");
  const [type, setType] = useState<PromoType>(promo?.type ?? "nota_percent");
  const [percent, setPercent] = useState(promo?.percent ?? 10);
  const [minPurchase, setMinPurchase] = useState(promo?.min_purchase ?? 0);
  const [productId, setProductId] = useState(promo?.product_id ?? products[0]?.id ?? "");
  const [minQty, setMinQty] = useState(promo?.min_qty ?? 1);
  const [startHour, setStartHour] = useState(promo?.start_hour ?? 9);
  const [endHour, setEndHour] = useState(promo?.end_hour ?? 12);
  const [active, setActive] = useState(promo?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const input: promoApi.PromoInput = {
        name: name.trim(),
        type,
        percent,
        is_active: active,
        min_purchase: type === "nota_percent" ? minPurchase : 0,
        product_id: type === "product_qty" ? productId : null,
        min_qty: type === "product_qty" ? minQty : 0,
        start_hour: type === "happy_hour" ? startHour : null,
        end_hour: type === "happy_hour" ? endHour : null,
      };
      if (promo) await promoApi.updatePromotion(promo.id, input);
      else await promoApi.createPromotion(input);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="modal modal-sm" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{promo ? "Edit Promo" : "Buat Promo"}</h2>
        {error && <p className="err-box">{error}</p>}
        <label className="field">
          Nama
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <label className="field">
          Jenis
          <select className="input" value={type} onChange={(e) => setType(e.target.value as PromoType)}>
            <option value="nota_percent">Diskon nota (%)</option>
            <option value="product_qty">Diskon qty produk (%)</option>
            <option value="happy_hour">Happy hour (%)</option>
          </select>
        </label>
        <label className="field">
          Diskon (%)
          <input
            className="input"
            type="number"
            min={1}
            max={100}
            value={percent}
            onChange={(e) => setPercent(Math.max(1, Math.min(100, Number(e.target.value))))}
          />
        </label>

        {type === "nota_percent" && (
          <label className="field">
            Minimal belanja (Rp)
            <input
              className="input"
              type="number"
              min={0}
              value={minPurchase}
              onChange={(e) => setMinPurchase(Math.max(0, Number(e.target.value)))}
            />
          </label>
        )}

        {type === "product_qty" && (
          <>
            <label className="field">
              Produk
              <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Minimal qty
              <input
                className="input"
                type="number"
                min={1}
                value={minQty}
                onChange={(e) => setMinQty(Math.max(1, Number(e.target.value)))}
              />
            </label>
          </>
        )}

        {type === "happy_hour" && (
          <div className="row">
            <label className="field" style={{ flex: 1 }}>
              Jam mulai
              <input
                className="input"
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(Math.max(0, Math.min(23, Number(e.target.value))))}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              Jam selesai
              <input
                className="input"
                type="number"
                min={0}
                max={23}
                value={endHour}
                onChange={(e) => setEndHour(Math.max(0, Math.min(23, Number(e.target.value))))}
              />
            </label>
          </div>
        )}

        <label className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Promo aktif
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
