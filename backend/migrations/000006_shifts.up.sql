-- Status shift kasir.
CREATE TYPE shift_status AS ENUM ('buka', 'tutup');

-- Shift kasir: buka (kas awal) → tutup (kas akhir + rekap). Rekap dihitung
-- on-the-fly dari transaksi pada rentang waktu shift milik kasir tsb.
CREATE TABLE shifts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opening_cash BIGINT NOT NULL DEFAULT 0,
    closing_cash BIGINT,
    status       shift_status NOT NULL DEFAULT 'buka',
    note         TEXT,
    opened_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at    TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_store ON shifts(store_id, opened_at DESC);

-- Hanya boleh ada satu shift terbuka per kasir.
CREATE UNIQUE INDEX uq_shifts_user_open ON shifts(user_id) WHERE status = 'buka';
