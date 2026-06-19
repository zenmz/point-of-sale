-- Kategori produk, dimiliki per toko.
CREATE TABLE categories (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id   UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_store_id ON categories(store_id);

-- Produk. Harga dalam rupiah penuh (BIGINT, tanpa desimal sen).
-- SKU & barcode unik per toko (bila diisi).
CREATE TABLE products (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id    UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name        TEXT NOT NULL,
    sku         TEXT,
    barcode     TEXT,
    price       BIGINT NOT NULL DEFAULT 0 CHECK (price >= 0),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);

-- SKU & barcode unik dalam satu toko (NULL tidak ikut constraint).
CREATE UNIQUE INDEX uq_products_store_sku
    ON products(store_id, sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX uq_products_store_barcode
    ON products(store_id, barcode) WHERE barcode IS NOT NULL;

-- Varian produk (mis. ukuran/warna). Harga opsional override harga produk.
CREATE TABLE variants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    sku         TEXT,
    price       BIGINT CHECK (price IS NULL OR price >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_variants_product_id ON variants(product_id);
