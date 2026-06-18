# MZ POS — Dokumen Desain & Planning

**Tanggal:** 2026-06-18
**Status:** Disetujui (planning)

---

## 1. Ringkasan

**MZ POS** adalah aplikasi Point of Sale (POS) berbasis web (PWA) yang
dirancang general/hybrid — dipakai berbagai tipe bisnis (retail, kafe, jasa).
Mendukung operasi **multi-toko** dengan laporan tergabung, dan tetap bisa
melayani **transaksi saat offline** (antri lokal, auto-sync saat online).

Pasar target: Indonesia (mendukung QRIS, e-wallet, transfer).

---

## 2. Keputusan Inti

| Aspek | Keputusan |
|-------|-----------|
| Nama | **MZ POS** |
| Tipe bisnis | General / Hybrid |
| Platform | Web app (PWA), offline-capable |
| Skala | Multi-toko (banyak cabang, laporan gabungan, transfer stok) |
| Scope dokumen | Visi penuh, dipecah per fase |
| Metode bayar | Tunai, QRIS, E-wallet / Transfer |
| Frontend | React (PWA) |
| Backend | Go + PostgreSQL |
| Model offline | Transaksi tetap jalan saat offline → antri lokal → auto-sync |

---

## 3. Arsitektur (Opsi A — Backend terpusat + PWA cache)

```
┌─────────────────────────┐         ┌──────────────────────────┐
│   React PWA (Browser)    │         │     Go Backend (Cloud)   │
│                          │  HTTPS  │                          │
│  - UI Kasir / Admin      │ ──────► │  - REST API              │
│  - Service Worker        │  REST   │  - Auth (JWT)            │
│  - IndexedDB (Dexie)     │ ◄────── │  - Modul: catalog,       │
│    • cache katalog       │  sync   │    inventory, txn,       │
│    • antrian transaksi   │         │    payment, report, sync │
└─────────────────────────┘         └────────────┬─────────────┘
                                                  │
                                          ┌───────▼────────┐
                                          │  PostgreSQL    │
                                          │ (sumber benar) │
                                          └────────────────┘
```

**Prinsip:**
- Server adalah **sumber kebenaran** untuk stok dan laporan.
- PWA menyimpan katalog produk + antrian transaksi di IndexedDB.
- Saat offline: penjualan tetap jalan, transaksi masuk antrian lokal.
- Saat online kembali: antrian sync ke server (idempotent via `client_id`).

**Alasan pilih Opsi A:** paling sederhana untuk dibangun, laporan multi-toko
mudah (data terpusat), dan tetap memenuhi kebutuhan offline transaksi tanpa
kompleksitas server lokal per toko atau sync engine CRDT.

---

## 4. Roadmap Fitur (per fase)

### Fase 1 — MVP (1 toko jalan dulu)

Tujuan: bisa jualan end-to-end di satu toko.

- **Auth & role** — login, role Admin / Kasir
- **Produk** — CRUD produk, kategori, varian sederhana, harga, barcode/SKU
- **Stok dasar** — qty masuk/keluar, stok berkurang otomatis saat jual
- **Transaksi / checkout** — keranjang, diskon per item & per nota, pajak/service charge, hitung total
- **Pembayaran**
  - Tunai (+ hitung kembalian)
  - QRIS (tampil QR statis/dinamis)
  - E-wallet / Transfer (tandai lunas manual)
- **Struk** — cetak thermal / PDF / share digital
- **Shift kasir** — buka/tutup laci, kas awal, rekap akhir shift
- **Laporan dasar** — penjualan harian, produk terlaris, ringkasan per metode bayar

### Fase 2 — Offline + Multi-toko

- **Offline transaksi** — antrian IndexedDB, auto-sync saat online, indikator status sync
- **Multi-toko** — entitas cabang, user per cabang, katalog bersama vs per-toko
- **Laporan gabungan** — lintas cabang, filter per toko
- **Transfer stok** antar cabang
- **Stock opname / audit**

### Fase 3 — Lanjutan

- **Pelanggan / CRM** — data member, poin loyalti, riwayat beli
- **Supplier & Purchase Order** — PO, terima barang, hutang supplier
- **Promo** — bundling, diskon kuantitas, happy hour
- **Dashboard analitik** — grafik tren, margin, prediksi stok
- **Integrasi hardware** — printer thermal, cash drawer, barcode scanner, customer display

---

## 5. Desain Teknis

### 5.1 Tech Stack

| Layer | Teknologi |
|-------|-----------|
| Frontend | React + Vite, PWA (service worker), IndexedDB via Dexie |
| Backend | Go (REST API — chi / gin), PostgreSQL |
| Auth | JWT, role-based access control |

### 5.2 Entitas Data Inti

```
Store (cabang)
  └─ User (role: admin|kasir, store_id)

Category
  └─ Product (sku, barcode, harga)
       └─ Variant

Inventory (stok per store)
  └─ StockMovement (log masuk/keluar, alasan)

Transaction (store_id, user_id, client_id, status)
  ├─ TransactionItem (product, qty, harga, diskon)
  ├─ Payment (metode, jumlah)
  └─ Discount (level nota)

Shift (buka/tutup laci, kas awal, kas akhir)
```

### 5.3 Alur Offline (Fase 2)

1. Katalog produk di-cache ke IndexedDB saat online.
2. Transaksi offline disimpan lokal dengan `client_id` (UUID) + status `pending`.
3. Saat online, antrian dikirim ke server.
4. Server **idempotent** — pakai `client_id` untuk cegah transaksi dobel.
5. Stok server adalah sumber kebenaran; konflik stok ditandai untuk admin.

### 5.4 Boundary Modul

Modul terpisah dengan tanggung jawab tunggal, komunikasi via API/interface:

| Modul | Tanggung jawab |
|-------|----------------|
| `auth` | Login, JWT, role |
| `catalog` | Produk, kategori, varian |
| `inventory` | Stok, pergerakan stok, transfer |
| `transaction` | Keranjang, checkout, riwayat transaksi |
| `payment` | Proses & catat pembayaran |
| `report` | Agregasi laporan penjualan |
| `sync` | Terima & rekonsiliasi antrian offline |

---

## 6. Out of Scope (YAGNI untuk sekarang)

- Server lokal per toko (Opsi B) — ditolak, terlalu kompleks/mahal.
- Sync engine CRDT full offline-first (Opsi C) — overkill untuk kebutuhan.
- Integrasi akuntansi eksternal, payroll, e-commerce — belum diperlukan.

---

## 7. Langkah Berikutnya

1. Review dokumen ini.
2. Buat rencana implementasi detail untuk **Fase 1 (MVP)**.
3. Setiap fase mendapat siklus spec → plan → implementasi tersendiri.
