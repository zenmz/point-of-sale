-- client_id: UUID dari klien untuk transaksi offline (idempotensi sync).
-- NULL untuk transaksi online biasa; unik bila diisi.
ALTER TABLE transactions ADD COLUMN client_id UUID;

CREATE UNIQUE INDEX uq_transactions_client_id
    ON transactions(client_id) WHERE client_id IS NOT NULL;
