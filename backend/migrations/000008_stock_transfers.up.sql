-- Transfer stok antar cabang. from_* = sumber, to_* = tujuan. Produk per toko
-- berbeda baris, jadi simpan id produk di kedua sisi (dipetakan via SKU/nama).
CREATE TABLE stock_transfers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    to_store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    from_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    to_product_id   UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    qty             BIGINT NOT NULL CHECK (qty > 0),
    note            TEXT,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_transfers_from ON stock_transfers(from_store_id, created_at DESC);
CREATE INDEX idx_stock_transfers_to ON stock_transfers(to_store_id, created_at DESC);
