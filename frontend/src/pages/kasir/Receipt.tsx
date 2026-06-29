import { formatRupiah } from "../../lib/format";
import type { Transaction } from "../../types/transaction";

const METHOD_LABEL: Record<string, string> = {
  tunai: "Tunai",
  qris: "QRIS",
  ewallet: "E-Wallet",
  transfer: "Transfer",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Receipt = struk siap cetak thermal (58/80mm). `width` mengubah lebar kertas.
export function Receipt({ tx, width = 80 }: { tx: Transaction; width?: 58 | 80 }) {
  return (
    <div className={`receipt receipt-${width}`}>
      <div className="r-center">
        <strong className="r-store">{tx.store_name}</strong>
        {tx.store_address && <div>{tx.store_address}</div>}
        {tx.store_phone && <div>{tx.store_phone}</div>}
      </div>

      <div className="r-rule" />

      <div className="r-meta">
        <div className="r-row">
          <span>Nota</span>
          <span>#{tx.number}</span>
        </div>
        <div className="r-row">
          <span>Waktu</span>
          <span>{formatWhen(tx.created_at)}</span>
        </div>
        {tx.cashier_name && (
          <div className="r-row">
            <span>Kasir</span>
            <span>{tx.cashier_name}</span>
          </div>
        )}
      </div>

      <div className="r-rule" />

      <div className="r-items">
        {tx.items.map((it) => (
          <div key={it.id} className="r-item">
            <div>{it.name}</div>
            <div className="r-row">
              <span>
                {it.qty} × {formatRupiah(it.price)}
                {it.discount > 0 && ` − ${formatRupiah(it.discount)}`}
              </span>
              <span>{formatRupiah(it.line_total)}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="r-rule" />

      <div className="r-row">
        <span>Subtotal</span>
        <span>{formatRupiah(tx.subtotal)}</span>
      </div>
      {tx.discount > 0 && (
        <div className="r-row">
          <span>Diskon</span>
          <span>−{formatRupiah(tx.discount)}</span>
        </div>
      )}
      {tx.tax > 0 && (
        <div className="r-row">
          <span>Pajak ({tx.tax_percent}%)</span>
          <span>{formatRupiah(tx.tax)}</span>
        </div>
      )}
      {tx.service_charge > 0 && (
        <div className="r-row">
          <span>Service ({tx.service_percent}%)</span>
          <span>{formatRupiah(tx.service_charge)}</span>
        </div>
      )}
      <div className="r-row r-total">
        <span>TOTAL</span>
        <span>{formatRupiah(tx.total)}</span>
      </div>

      {tx.payment && (
        <>
          <div className="r-rule" />
          <div className="r-row">
            <span>{METHOD_LABEL[tx.payment.method] ?? tx.payment.method}</span>
            <span>{formatRupiah(tx.payment.amount)}</span>
          </div>
          {tx.payment.change > 0 && (
            <div className="r-row">
              <span>Kembalian</span>
              <span>{formatRupiah(tx.payment.change)}</span>
            </div>
          )}
        </>
      )}

      <div className="r-rule" />
      <div className="r-center r-foot">
        <div>Terima kasih 🙏</div>
        <div>Barang yang sudah dibeli dapat ditukar sesuai ketentuan.</div>
      </div>
    </div>
  );
}
