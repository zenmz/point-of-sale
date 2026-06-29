# MZ POS — Task Breakdown

**Tanggal:** 2026-06-18
**Dokumen terkait:** [Desain](./2026-06-18-mz-pos-design.md) · [PRD](./2026-06-18-mz-pos-prd.md)

Tiap fase dipecah jadi **milestone kecil**, tiap milestone jadi **task granular**
yang bisa dikerjakan & dites mandiri. Urutan dari atas ke bawah = urutan kerja
yang disarankan.

Legenda: `[BE]` backend Go · `[FE]` frontend React · `[DB]` skema database · `[INFRA]` setup

---

## FASE 1 — MVP (1 toko)

### M1.0 — Fondasi Proyek ✅
- [x] `[INFRA]` Inisialisasi repo + struktur folder (frontend/, backend/)
- [x] `[INFRA]` Setup Go module, framework REST (Fiber), config env
- [x] `[INFRA]` Setup React + Vite + struktur folder
- [x] `[INFRA]` Setup PostgreSQL lokal + tool migrasi (golang-migrate)
- [x] `[INFRA]` Setup linter, formatter, CI dasar _(pre-commit hook belum dipasang)_
- [x] `[DB]` Skema awal: tabel `users`, `stores` (single store default)

### M1.1 — Autentikasi & Role ✅
- [x] `[DB]` Tabel `users` (email, password_hash, role, store_id)
- [x] `[BE]` Endpoint register (admin pertama) + hash password (argon2id)
- [x] `[BE]` Endpoint login → JWT
- [x] `[BE]` Middleware verifikasi JWT + cek role
- [x] `[FE]` Halaman login + simpan token
- [x] `[FE]` Route guard berdasar role (Admin/Kasir)
- [x] `[FE]` Logout

### M1.2 — Manajemen Produk ✅
- [x] `[DB]` Tabel `categories`, `products`, `variants`
- [x] `[BE]` CRUD kategori
- [x] `[BE]` CRUD produk (sku, barcode, harga)
- [x] `[BE]` CRUD varian produk
- [x] `[FE]` Halaman daftar produk + search
- [x] `[FE]` Form tambah/edit produk + kategori + varian
- [x] `[FE]` Hapus produk (konfirmasi)

> Catatan: UI kategori (CRUD) belum dibuat — kategori dipilih di form produk via
> dropdown, tapi penambahan kategori baru lewat UI belum ada (endpoint backend
> siap). Hapus produk = soft-delete. Varian count di list via subquery.

### M1.2b — Fondasi UI (design system + app shell) ✅
- [x] `[FE]` Design system "Pasar": token warna (jade/kertas/ink/saffron), 3 font
      (Bricolage Grotesque / Inter / Spline Sans Mono), kelas dasar (btn, field,
      card, table, chip, tear-line, money)
- [x] `[FE]` App shell: sidebar nav (mengikuti roadmap, item belum jadi = "segera")
      + topbar (chip shift, user, logout) + responsif bottom/burger di mobile
- [x] `[FE]` Refit halaman login, register, dashboard, produk, form ke design system

### M1.3 — Stok Dasar ✅
- [x] `[DB]` Tabel `inventory` (stok per produk), `stock_movements`
- [x] `[BE]` Endpoint set/adjust stok (masuk/keluar + alasan)
- [x] `[BE]` Catat `stock_movement` tiap perubahan (audit trail)
- [x] `[FE]` Halaman kelola stok + riwayat pergerakan
- [x] `[FE]` Tampilkan stok di daftar produk

> Catatan: stok di level produk (bukan varian) untuk MVP. Penyesuaian
> transaksional (kunci baris + upsert + catat movement). Tiga jenis gerakan:
> masuk/keluar/penyesuaian (set absolut). Ambang "menipis" = 5 (tetap, di FE).

### M1.4 — Keranjang & Checkout ✅
- [x] `[FE]` UI kasir: cari/scan produk → tambah ke keranjang
- [x] `[FE]` Ubah qty, hapus item dari keranjang
- [x] `[FE]` Diskon per item & per nota
- [x] `[FE]` Hitung pajak / service charge (konfigurable)
- [x] `[FE]` Tampilkan subtotal, diskon, pajak, total
- [x] `[DB]` Tabel `transactions`, `transaction_items`
- [x] `[BE]` Endpoint buat transaksi → kurangi stok (transaksional)
- [x] `[BE]` Validasi stok cukup saat checkout

> Catatan: total dihitung ulang otoritatif di server (klien tak bisa
> manipulasi). Checkout transaksional: kunci stok (FOR UPDATE) + advisory lock
> per toko untuk penomoran nota, kurangi stok + catat `stock_movement` 'keluar'.
> Nama & harga item di-snapshot. Pajak/service % konfigurable di UI kasir
> (default 0). Pembayaran & struk = M1.5/M1.6. `client_id` (offline) = M2.1.

### M1.5 — Pembayaran ✅
- [x] `[DB]` Tabel `payments` (method, amount)
- [x] `[BE]` Catat pembayaran terkait transaksi
- [x] `[FE]` Bayar tunai + hitung kembalian
- [x] `[FE]` Bayar QRIS — tampilkan QR (statis dulu) + tombol tandai lunas
- [x] `[FE]` Bayar e-wallet/transfer — tandai lunas manual
- [x] `[FE]` Layar sukses transaksi

> Catatan: pembayaran dicatat **atomik di dalam checkout** (satu DB tx dengan
> nota + stok) — bukan endpoint terpisah, agar nota tak pernah ada tanpa bayar.
> `paid_amount` wajib ≥ total (server validasi), kembalian = bayar − total.
> QRIS = QR placeholder statis (dinamis menyusul). Split bayar = nanti.

### M1.6 — Struk ✅
- [x] `[BE]` Generate data struk (nomor nota, item, total, bayar)
- [x] `[FE]` Layout struk (thermal 58/80mm friendly)
- [x] `[FE]` Cetak via browser print
- [x] `[FE]` Export PDF / share digital (link/gambar)

> Catatan: data struk dari GET /transactions/:id (ditambah nama/alamat/telp toko).
> Halaman `/struk/:id` dengan toggle lebar 58/80mm, `window.print()` (Save as PDF
> dari dialog cetak), dan Bagikan (Web Share / salin tautan). Export **gambar**
> ditunda (perlu html2canvas) — link + PDF sudah cukup untuk MVP.

### M1.7 — Shift Kasir ✅
- [x] `[DB]` Tabel `shifts` (user, kas_awal, kas_akhir, waktu)
- [x] `[BE]` Endpoint buka shift (kas awal)
- [x] `[BE]` Endpoint tutup shift + rekap (total tunai, non-tunai, jumlah transaksi)
- [x] `[FE]` Modal buka shift saat mulai
- [x] `[FE]` Layar tutup shift + ringkasan rekap

> Catatan: rekap dihitung on-the-fly dari transaksi 'selesai' milik kasir pada
> rentang waktu shift (tanpa kolom shift_id di transaksi). Tunai bersih = amount −
> kembalian. Satu shift terbuka per kasir (unique index parsial). Endpoint:
> GET /shifts/current (204 bila tak ada), POST /shifts/open, /shifts/close.
> Chip shift di topbar jadi tombol buka/tutup; tutup tampilkan rekap + selisih.

### M1.8 — Laporan Dasar ✅
- [x] `[BE]` Endpoint laporan penjualan harian
- [x] `[BE]` Endpoint produk terlaris
- [x] `[BE]` Endpoint ringkasan per metode bayar
- [x] `[FE]` Halaman laporan + filter tanggal
- [x] `[FE]` Tampilkan ringkasan (kartu + tabel)

> Catatan: laporan hanya admin/owner (RBAC). Endpoint /reports/sales (ringkasan +
> harian), /top-products, /payment-methods; filter from/to (default hari ini).
> Hanya transaksi 'selesai'. Metode bayar pakai nilai bersih (amount − kembalian).
> Nav "Laporan" & quick link dashboard di-gate per role.

### M1.9 — Rilis MVP ✅
- [x] `[INFRA]` Setup PWA manifest + service worker dasar (installable)
- [x] `[INFRA]` Build & deploy backend + frontend (staging)
- [x] `[ ]` Uji end-to-end alur jual → bayar → struk → laporan
- [x] `[ ]` Dokumentasi penggunaan singkat

> Catatan: PWA = manifest.webmanifest + icon 192/512 (generator
> `scripts/gen-icons.mjs`) + service worker dasar (`public/sw.js`, cache shell,
> registrasi di produksi). Deploy: Dockerfile backend/frontend + nginx (proxy
> /api) + `docker-compose.prod.yml` (db + migrate + backend + frontend) —
> image backend ter-build & migrasi jalan saat verifikasi. **Uji E2E live**
> lulus (jual→bayar→struk→laporan, lihat tabel di Panduan). Dokumentasi:
> [Panduan Penggunaan](./2026-06-29-mz-pos-panduan.md). **Fase 1 (MVP) selesai.**

---

## FASE 2 — Offline + Multi-toko

### M2.0 — Fondasi Offline
- [ ] `[FE]` Setup IndexedDB (Dexie) + skema lokal
- [ ] `[FE]` Cache katalog produk ke IndexedDB saat online
- [ ] `[FE]` Deteksi status online/offline

### M2.1 — Transaksi Offline
- [ ] `[FE]` Simpan transaksi offline ke antrian lokal (client_id UUID, status pending)
- [ ] `[FE]` Lanjutkan checkout penuh tanpa koneksi
- [ ] `[DB]` Tambah kolom `client_id` unik di `transactions`
- [ ] `[BE]` Endpoint sync idempotent (cek client_id, skip jika ada)

### M2.2 — Sync Engine
- [ ] `[FE]` Auto-sync antrian saat online kembali
- [ ] `[FE]` Retry transaksi gagal + backoff
- [ ] `[FE]` Indikator status sync (pending/sukses/gagal) per transaksi
- [ ] `[BE]` Rekonsiliasi stok + tandai konflik untuk admin

### M2.3 — Multi-toko
- [ ] `[DB]` Perkuat entitas `stores`; relasi user ↔ store
- [ ] `[BE]` Scope data per store (produk, stok, transaksi)
- [ ] `[BE]` Manajemen user per cabang (role Owner)
- [ ] `[FE]` Switcher cabang + manajemen user antar cabang
- [ ] `[FE]` Katalog bersama vs per-toko

### M2.4 — Laporan Gabungan
- [ ] `[BE]` Agregasi laporan lintas cabang
- [ ] `[FE]` Filter laporan per toko / semua toko

### M2.5 — Transfer Stok & Opname
- [ ] `[DB]` Tabel `stock_transfers`
- [ ] `[BE]` Endpoint transfer stok antar cabang (kurangi sumber, tambah tujuan)
- [ ] `[FE]` UI transfer stok
- [ ] `[BE]` `[FE]` Stock opname/audit (input fisik vs sistem, selisih)

---

## FASE 3 — Lanjutan

### M3.1 — CRM / Member
- [ ] `[DB]` Tabel `customers`, `loyalty_points`
- [ ] `[BE]` CRUD member + akumulasi/penukaran poin
- [ ] `[FE]` Pilih/daftar member saat transaksi + riwayat beli

### M3.2 — Supplier & Purchase Order
- [ ] `[DB]` Tabel `suppliers`, `purchase_orders`, `po_items`
- [ ] `[BE]` Buat PO, terima barang (tambah stok), catat hutang
- [ ] `[FE]` UI supplier + PO + penerimaan barang

### M3.3 — Promo
- [ ] `[DB]` Tabel `promotions`
- [ ] `[BE]` Engine promo (bundling, diskon qty, happy hour)
- [ ] `[FE]` UI buat/atur promo + terapkan otomatis di checkout

### M3.4 — Dashboard Analitik
- [ ] `[BE]` Endpoint agregasi tren, margin, prediksi stok
- [ ] `[FE]` Dashboard grafik (tren penjualan, margin, alert stok)

### M3.5 — Integrasi Hardware
- [ ] `[FE]` Integrasi printer thermal (WebUSB/escpos)
- [ ] `[FE]` Cash drawer (trigger via printer)
- [ ] `[FE]` Barcode scanner (input keyboard wedge)
- [ ] `[FE]` Customer display

---

## Catatan Eksekusi

- Kerjakan **per milestone**, selesaikan + tes sebelum lanjut.
- Tiap milestone idealnya menghasilkan sesuatu yang bisa didemo.
- Fase 1 adalah prioritas; Fase 2 & 3 baru dimulai setelah MVP stabil.
- Tiap fase besar nanti dapat siklus spec → plan → implementasi tersendiri.
