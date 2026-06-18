-- Ekstensi UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Toko / cabang. Multi-toko didukung sejak awal; MVP pakai 1 toko default.
CREATE TABLE stores (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT NOT NULL,
    address    TEXT,
    phone      TEXT,
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Peran pengguna.
CREATE TYPE user_role AS ENUM ('admin', 'kasir', 'owner');

-- Pengguna. Terikat ke satu toko (store_id) untuk scoping data.
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          user_role NOT NULL DEFAULT 'kasir',
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_store_id ON users(store_id);
