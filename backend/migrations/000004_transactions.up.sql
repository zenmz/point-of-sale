-- Status transaksi. MVP: checkout langsung 'selesai'; 'batal' untuk void nanti.
CREATE TYPE transaction_status AS ENUM ('selesai', 'batal');

-- Nota penjualan. Nomor nota berurut per toko (lihat numbering di repo).
-- Nilai uang dalam rupiah penuh (BIGINT). Persen pajak/service disimpan untuk audit.
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    cashier_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    number          BIGINT NOT NULL,                 -- nomor nota per toko
    subtotal        BIGINT NOT NULL,                 -- jumlah line_total sebelum diskon nota
    discount        BIGINT NOT NULL DEFAULT 0,       -- diskon level nota (Rp)
    tax_percent     NUMERIC(5,2) NOT NULL DEFAULT 0,
    tax             BIGINT NOT NULL DEFAULT 0,
    service_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    service_charge  BIGINT NOT NULL DEFAULT 0,
    total           BIGINT NOT NULL,
    status          transaction_status NOT NULL DEFAULT 'selesai',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_store ON transactions(store_id, created_at DESC);
CREATE UNIQUE INDEX uq_transactions_store_number ON transactions(store_id, number);

-- Baris item nota. Nama & harga di-snapshot agar nota historis tidak berubah
-- saat produk diedit/dihapus.
CREATE TABLE transaction_items (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
    name           TEXT NOT NULL,                    -- snapshot nama produk
    price          BIGINT NOT NULL,                  -- snapshot harga satuan
    qty            BIGINT NOT NULL CHECK (qty > 0),
    discount       BIGINT NOT NULL DEFAULT 0,        -- diskon per item (Rp)
    line_total     BIGINT NOT NULL,                  -- price*qty - discount
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_items_tx ON transaction_items(transaction_id);
