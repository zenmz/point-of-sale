# MZ POS

Aplikasi Point of Sale (POS) berbasis web (PWA), general/hybrid, multi-toko,
tahan offline untuk transaksi. Pasar: Indonesia (QRIS, e-wallet, transfer).

## Stack

- **Frontend:** React + Vite + TypeScript, PWA (IndexedDB/Dexie)
- **Backend:** Go + Fiber, PostgreSQL
- **Auth:** JWT, RBAC

## Fitur

- **Kasir & checkout** — keranjang, diskon item/nota, pajak/service, pembayaran
  (tunai/QRIS/e-wallet/transfer), struk thermal 58/80mm.
- **Offline penuh** — transaksi tetap jalan tanpa koneksi, antri lokal, auto-sync
  idempoten (client_id) + retry backoff saat online kembali.
- **Multi-toko** — owner pindah cabang, kelola cabang & pengguna lintas cabang,
  salin katalog, transfer stok antar cabang, opname, laporan gabungan.
- **CRM** — member + poin loyalitas. **Promo** otomatis (diskon nota/qty/happy
  hour). **Pembelian/PO** + hutang. **Analitik** (tren, margin, prediksi stok).
- **Hardware** — printer thermal & cash drawer (WebUSB/ESC-POS), barcode scanner
  (keyboard-wedge), layar pelanggan.

## Struktur

```
backend/    API Go + Fiber
frontend/   React PWA
docs/        Desain, PRD, task breakdown
```

## Dokumentasi

- [Panduan Penggunaan](./docs/2026-06-29-mz-pos-panduan.md)
- [Desain & Arsitektur](./docs/2026-06-18-mz-pos-design.md)
- [PRD](./docs/2026-06-18-mz-pos-prd.md)
- [Task Breakdown](./docs/2026-06-18-mz-pos-tasks.md)

## Mulai (development)

```bash
# 1. Jalankan database
docker compose up -d db

# 2. Backend
cd backend && cp .env.example .env && go run ./cmd/api

# 3. Frontend
cd frontend && npm install && npm run dev
```

## Deploy (staging/produksi)

Seluruh stack (db + migrasi + backend + frontend/nginx) lewat satu compose:

```bash
JWT_SECRET=ganti-rahasia docker compose -f docker-compose.prod.yml up -d --build
# Buka http://localhost:8080
```

- `migrate` menjalankan migrasi DB sebelum backend start.
- `frontend` (nginx) menyajikan PWA & mem-proxy `/api` ke backend (satu origin).
- Atur `JWT_SECRET` dan `DB_PASSWORD` lewat environment di server.

PWA installable (manifest + service worker `frontend/public/sw.js`) dengan
sinkronisasi transaksi offline penuh (Fase 2). Status pengerjaan per milestone:
[Task Breakdown](./docs/2026-06-18-mz-pos-tasks.md).
