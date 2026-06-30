-- Urutan baris nota (agar tampil sesuai urutan keranjang) + varian terpilih.
ALTER TABLE transaction_items
    ADD COLUMN line_no    INT  NOT NULL DEFAULT 0,
    ADD COLUMN variant_id UUID REFERENCES variants(id) ON DELETE SET NULL;
