-- Metode pembayaran yang didukung MVP.
CREATE TYPE payment_method AS ENUM ('tunai', 'qris', 'ewallet', 'transfer');

-- Pembayaran terkait transaksi. MVP: satu pembayaran per nota (split bayar
-- menyusul). amount = jumlah dibayar; change_amount = kembalian (tunai).
CREATE TABLE payments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    store_id       UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    method         payment_method NOT NULL,
    amount         BIGINT NOT NULL,
    change_amount  BIGINT NOT NULL DEFAULT 0,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_transaction ON payments(transaction_id);
CREATE INDEX idx_payments_store ON payments(store_id, created_at DESC);
