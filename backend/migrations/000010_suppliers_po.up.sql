-- Pemasok / supplier, per toko.
CREATE TABLE suppliers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    address    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_store ON suppliers(store_id);

-- Status PO: dipesan → diterima (stok bertambah) / batal.
CREATE TYPE po_status AS ENUM ('dipesan', 'diterima', 'batal');

-- Pesanan pembelian (PO). is_paid = status hutang (false = belum lunas).
CREATE TABLE purchase_orders (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    number      BIGINT NOT NULL,            -- nomor PO per toko
    status      po_status NOT NULL DEFAULT 'dipesan',
    total       BIGINT NOT NULL DEFAULT 0,  -- total biaya beli (Rp)
    is_paid     BOOLEAN NOT NULL DEFAULT FALSE,
    note        TEXT,
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    received_at TIMESTAMPTZ
);

CREATE INDEX idx_po_store ON purchase_orders(store_id, created_at DESC);
CREATE UNIQUE INDEX uq_po_store_number ON purchase_orders(store_id, number);

-- Baris item PO. name di-snapshot agar tetap walau produk diubah/dihapus.
CREATE TABLE po_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id      UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    qty        BIGINT NOT NULL CHECK (qty > 0),
    cost       BIGINT NOT NULL CHECK (cost >= 0),  -- harga beli per unit
    subtotal   BIGINT NOT NULL                      -- qty * cost
);

CREATE INDEX idx_po_items_po ON po_items(po_id);
