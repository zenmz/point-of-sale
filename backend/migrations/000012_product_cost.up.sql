-- Harga modal (cost) per produk untuk hitung margin. Diisi manual atau
-- diperbarui otomatis dari harga beli saat penerimaan PO.
ALTER TABLE products ADD COLUMN cost BIGINT NOT NULL DEFAULT 0 CHECK (cost >= 0);
