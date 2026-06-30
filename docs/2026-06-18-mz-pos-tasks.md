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

> Catatan: UI kategori (CRUD) tersedia lewat tombol **Kategori** di halaman
> Produk (modal tambah/ubah/hapus). Hapus produk = soft-delete; hapus kategori =
> produk terkait jadi tanpa kategori (ON DELETE SET NULL). Varian count via subquery.

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

### M2.0 — Fondasi Offline ✅
- [x] `[FE]` Setup IndexedDB (Dexie) + skema lokal
- [x] `[FE]` Cache katalog produk ke IndexedDB saat online
- [x] `[FE]` Deteksi status online/offline

> Catatan: Dexie db `mzpos` (tabel products, categories). `loadProducts` cache
> saat online + fallback ke cache saat offline (error HTTP tetap dilempar, beda
> dari offline). Hook `useOnline` + badge "Offline" di topbar. Kasir tampilkan
> notice offline & nonaktifkan tombol bayar (checkout offline = M2.1).

### M2.1 — Transaksi Offline ✅
- [x] `[FE]` Simpan transaksi offline ke antrian lokal (client_id UUID, status pending)
- [x] `[FE]` Lanjutkan checkout penuh tanpa koneksi
- [x] `[DB]` Tambah kolom `client_id` unik di `transactions`
- [x] `[BE]` Endpoint sync idempotent (cek client_id, skip jika ada)

> Catatan: checkout kini idempoten — client_id (UUID) dicek dulu; bila sudah ada,
> kembalikan transaksi tsb (aman untuk retry sync). Klien selalu kirim client_id.
> Offline: payment modal jalan penuh, transaksi masuk antrian Dexie (tabel
> pendingTx, status pending) + layar sukses offline. Auto-sync/retry = M2.2.

### M2.2 — Sync Engine ✅
- [x] `[FE]` Auto-sync antrian saat online kembali
- [x] `[FE]` Retry transaksi gagal + backoff
- [x] `[FE]` Indikator status sync (pending/sukses/gagal) per transaksi
- [x] `[BE]` Rekonsiliasi stok + tandai konflik untuk admin

> Catatan: SyncProvider auto-sync saat mount + event `online`; error jaringan →
> retry backoff eksponensial (2s→30s). Konflik server (mis. stok kurang) ditandai
> status 'error' (tidak di-retry otomatis; admin pakai "Coba lagi"). SyncWidget di
> topbar (menyinkron/tertunda/konflik) + panel rincian antrian.
> **Uji live:** client_id sama 2× → 1 nota, stok 5→3 (bukan 1) = idempoten;
> oversell → HTTP 409 detail produk (rekonsiliasi stok server otoritatif).

### M2.3 — Multi-toko ✅
- [x] `[DB]` Perkuat entitas `stores`; relasi user ↔ store
- [x] `[BE]` Scope data per store (produk, stok, transaksi)
- [x] `[BE]` Manajemen user per cabang (role Owner)
- [x] `[FE]` Switcher cabang + manajemen user antar cabang
- [x] `[FE]` Katalog bersama vs per-toko

> Catatan: skema sudah multi-toko sejak M1.0 (semua entitas ber-`store_id`),
> scoping data otomatis dari `store_id` di JWT — tak perlu migrasi baru.
> **User pertama (bootstrap register) kini `owner`** (pemilik usaha), bukan admin.
> Owner: lintas cabang. Switcher = terbitkan ulang JWT untuk cabang tujuan
> (`POST /stores/:id/switch`), semua query ikut `store_id` token baru. Manajemen
> toko (`/stores`) khusus owner; manajemen pengguna (`/users`) owner (semua
> cabang) / admin (cabang sendiri, tak boleh role owner). "Katalog bersama" =
> opsi **salin katalog** (kategori+produk+varian, stok tidak) saat buat cabang;
> default per-toko (kosong). **Uji live:** salin katalog A→C (baris independen),
> switch re-scope produk, kasir/admin lintas-cabang ditolak 403.

### M2.4 — Laporan Gabungan ✅
- [x] `[BE]` Agregasi laporan lintas cabang
- [x] `[FE]` Filter laporan per toko / semua toko

> Catatan: laporan kini menerima `?store_id=` (owner). Kosong/"all" = agregasi
> semua cabang; non-owner terkunci ke cabangnya (`reportScope`). Query pakai
> filter opsional `($1::uuid IS NULL OR store_id = $1)`. `/reports/sales`
> menambah rincian `by_store` (total per cabang). FE: dropdown cabang (owner) +
> tabel "Per cabang" saat >1 cabang. **Uji live:** 2 nota di Toko A & C →
> gabungan 126rb (A 36rb + C 90rb), metode bayar tergabung, filter A isolasi benar.

### M2.5 — Transfer Stok & Opname ✅
- [x] `[DB]` Tabel `stock_transfers`
- [x] `[BE]` Endpoint transfer stok antar cabang (kurangi sumber, tambah tujuan)
- [x] `[FE]` UI transfer stok
- [x] `[BE]` `[FE]` Stock opname/audit (input fisik vs sistem, selisih)

> Catatan: transfer (owner) `POST /inventory/transfer` — 1 transaksi: kunci stok
> sumber, kurangi (keluar), padankan produk di cabang tujuan via SKU lalu nama,
> tambah (masuk), catat baris `stock_transfers` + 2 `stock_movement`. Stok wajib
> cukup (409 bila kurang). `GET /inventory/transfers` riwayat masuk/keluar cabang.
> Opname (admin/owner) `POST /inventory/opname` — input fisik per produk, server
> terapkan penyesuaian (set absolut) untuk yang selisihnya ≠ 0, kembalikan
> rincian selisih. FE: tombol Transfer (owner) & Opname di halaman Stok.
> **Uji live:** transfer A→C 10 unit (A −10, C +10, padanan via SKU), opname
> selisih −3 diterapkan, oversell 409, kasir transfer 403.

---

## FASE 3 — Lanjutan

### M3.1 — CRM / Member ✅
- [x] `[DB]` Tabel `customers`, `loyalty_points`
- [x] `[BE]` CRUD member + akumulasi/penukaran poin
- [x] `[FE]` Pilih/daftar member saat transaksi + riwayat beli

> Catatan: tabel `customers` (saldo poin) + `loyalty_points` (buku besar) +
> kolom `customer_id`/`points_earned` di transactions (migrasi 000009). CRUD
> member (`/customers`, daftar/cari boleh kasir; ubah & redeem admin/owner).
> Checkout opsional `customer_id` → poin earn = total/1000 (atomik di dalam tx
> checkout: tambah saldo + ledger 'earn'). Redeem `POST /customers/:id/redeem`
> (kurangi saldo + ledger, 409 bila kurang). Detail member = saldo + riwayat
> poin + riwayat beli. FE: MemberModal (cari/daftar) di kasir, badge poin di
> layar sukses, halaman Pelanggan (list + rincian + redeem). **Uji live:**
> belanja Rp54rb → +54 poin, redeem 5 → saldo 49, over-redeem 409, member palsu 404.

### M3.2 — Supplier & Purchase Order ✅
- [x] `[DB]` Tabel `suppliers`, `purchase_orders`, `po_items`
- [x] `[BE]` Buat PO, terima barang (tambah stok), catat hutang
- [x] `[FE]` UI supplier + PO + penerimaan barang

> Catatan: tabel suppliers + purchase_orders (status dipesan/diterima/batal,
> is_paid) + po_items (migrasi 000010). PO (admin/owner): buat (`POST
> /purchase-orders`, nomor per toko, snapshot nama+subtotal), terima
> (`/receive` → stok +qty tiap item + movement 'masuk', status diterima), bayar
> (`/pay` → is_paid), batal (`/cancel`, hanya saat dipesan). Hutang =
> Σ total PO diterima & belum lunas (`GET /purchase-orders/debt`). FE: halaman
> Pembelian (tab Pesanan/Pemasok, banner hutang, form PO multi-item, rincian +
> aksi terima/bayar/batal). **Uji live:** PO 20×Rp8rb → stok +20, hutang
> Rp160rb, bayar → hutang 0, terima/bayar ganda 400, kasir akses 403.

### M3.3 — Promo ✅
- [x] `[DB]` Tabel `promotions`
- [x] `[BE]` Engine promo (bundling, diskon qty, happy hour)
- [x] `[FE]` UI buat/atur promo + terapkan otomatis di checkout

> Catatan: tabel promotions (tipe nota_percent/product_qty/happy_hour) + kolom
> promo_discount di transactions (migrasi 000011). Engine `promo.Compute` =
> fungsi murni (7 unit test): product_qty diskon per-baris (boleh menumpuk antar
> produk), nota_percent & happy_hour level-nota ambil yang terbesar (tak
> menumpuk), total dibatasi subtotal. Diterapkan **otomatis & otoritatif di
> dalam tx checkout** (ambil promo aktif → Compute → kurangi sebelum pajak).
> `POST /promotions/preview` untuk pratinjau di kasir. CRUD promo admin/owner.
> FE: halaman Promo + baris "Promo −Rp" di kasir (estimasi; server final).
> **Uji live:** nota 10%→−3,6rb; beli 3 diskon 50%→−27rb; qty<min→0; kasir 403.

### M3.4 — Dashboard Analitik ✅
- [x] `[BE]` Endpoint agregasi tren, margin, prediksi stok
- [x] `[FE]` Dashboard grafik (tren penjualan, margin, alert stok)

> Catatan: kolom `products.cost` (harga modal, migrasi 000012) — diisi manual di
> form produk ATAU otomatis dari harga beli saat penerimaan PO. `GET
> /analytics/dashboard?days=N` (admin/owner): tren penjualan harian, margin
> (revenue − Σ cost×qty, %), prediksi stok (kecepatan jual qty/hari → perkiraan
> hari habis; flag bila stok ≤5 atau habis <7 hari). FE: Ringkasan (home)
> menampilkan kartu penjualan/laba/margin + grafik bar tren + tabel alert stok.
> **Uji live:** PO set cost 8rb → margin 55,6% (rev 252rb−cost 112rb), tren
> harian, kasir 403. ponytail: margin pakai cost terbaru (bukan snapshot per nota).

### M3.5 — Integrasi Hardware ✅
- [x] `[FE]` Integrasi printer thermal (WebUSB/escpos)
- [x] `[FE]` Cash drawer (trigger via printer)
- [x] `[FE]` Barcode scanner (input keyboard wedge)
- [x] `[FE]` Customer display

> Catatan: printer thermal via **WebUSB + ESC/POS** (`lib/escpos.ts`,
> `ThermalPrinter`): init → struk teks 32 kolom → potong; tombol "Cetak thermal"
> di layar sukses. **Cash drawer** = pulse ESC p (laci lewat printer), tombol
> "Buka laci". **Barcode scanner** = `useBarcodeScanner` (keyboard wedge: burst
> ketikan <40ms + Enter → cari produk via barcode lalu SKU → masuk keranjang).
> **Customer display** = `/display` (jendela kedua, full-screen) disinkron dari
> kasir lewat BroadcastChannel (`lib/customerDisplay.ts`). ponytail: WebUSB
> butuh HTTPS/localhost + izin perangkat (Chromium); diverifikasi via build/tipe,
> uji perangkat fisik saat hardware tersedia. **Fase 3 selesai.**

---

## Catatan Eksekusi

- Kerjakan **per milestone**, selesaikan + tes sebelum lanjut.
- Tiap milestone idealnya menghasilkan sesuatu yang bisa didemo.
- Fase 1 adalah prioritas; Fase 2 & 3 baru dimulai setelah MVP stabil.
- Tiap fase besar nanti dapat siklus spec → plan → implementasi tersendiri.
