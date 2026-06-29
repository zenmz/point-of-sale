-- Stok per produk (MVP: level produk, bukan varian).
-- Satu baris per produk; dibuat otomatis saat penyesuaian stok pertama.
CREATE TABLE inventory (
    product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    quantity   BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inventory_store_id ON inventory(store_id);

-- Jenis pergerakan stok: barang masuk, keluar, atau penyesuaian (set absolut).
CREATE TYPE stock_movement_type AS ENUM ('masuk', 'keluar', 'penyesuaian');

-- Audit trail tiap perubahan stok. Tidak pernah dihapus (riwayat permanen).
CREATE TABLE stock_movements (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type       stock_movement_type NOT NULL,
    delta      BIGINT NOT NULL,        -- selisih perubahan (+masuk / -keluar)
    qty_after  BIGINT NOT NULL,        -- stok sesudah perubahan
    reason     TEXT,                   -- alasan / catatan
    user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_store ON stock_movements(store_id);
