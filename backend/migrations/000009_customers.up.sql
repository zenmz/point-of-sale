-- Pelanggan / member, dimiliki per toko.
CREATE TABLE customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    phone      TEXT,
    email      TEXT,
    points     BIGINT NOT NULL DEFAULT 0 CHECK (points >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_store ON customers(store_id);
-- Telepon unik per toko (bila diisi) — dipakai sbg pencarian member cepat.
CREATE UNIQUE INDEX uq_customers_store_phone
    ON customers(store_id, phone) WHERE phone IS NOT NULL;

-- Jenis mutasi poin: earn (dari belanja), redeem (penukaran), adjust (manual).
CREATE TYPE loyalty_type AS ENUM ('earn', 'redeem', 'adjust');

-- Buku besar poin loyalitas (audit; saldo disimpan juga di customers.points).
CREATE TABLE loyalty_points (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    type           loyalty_type NOT NULL,
    points         BIGINT NOT NULL,        -- +earn / -redeem
    balance_after  BIGINT NOT NULL,        -- saldo poin sesudah mutasi
    transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loyalty_customer ON loyalty_points(customer_id, created_at DESC);

-- Kaitkan transaksi ke member + poin yang diperoleh nota itu.
ALTER TABLE transactions
    ADD COLUMN customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
    ADD COLUMN points_earned BIGINT NOT NULL DEFAULT 0;
