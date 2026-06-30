-- Jenis promo: diskon % nota, diskon qty per produk, happy hour (% berdasar jam).
CREATE TYPE promo_type AS ENUM ('nota_percent', 'product_qty', 'happy_hour');

CREATE TABLE promotions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         promo_type NOT NULL,
    percent      NUMERIC(5,2) NOT NULL DEFAULT 0,   -- besar diskon (%)
    min_purchase BIGINT NOT NULL DEFAULT 0,         -- nota_percent: min belanja
    product_id   UUID REFERENCES products(id) ON DELETE CASCADE, -- product_qty
    min_qty      BIGINT NOT NULL DEFAULT 0,         -- product_qty: min qty
    start_hour   INT,                                -- happy_hour: jam mulai (0-23)
    end_hour     INT,                                -- happy_hour: jam selesai (eksklusif)
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promotions_store ON promotions(store_id);

-- Diskon promo otomatis yang diterapkan saat checkout (untuk audit & struk).
ALTER TABLE transactions
    ADD COLUMN promo_discount BIGINT NOT NULL DEFAULT 0;
