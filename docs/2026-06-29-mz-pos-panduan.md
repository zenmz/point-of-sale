# MZ POS — Panduan Penggunaan (MVP)

**Tanggal:** 2026-06-29 · Untuk Fase 1 (MVP, 1 toko).

Panduan singkat alur pakai harian. Untuk arsitektur lihat
[Desain](./2026-06-18-mz-pos-design.md).

---

## 1. Peran

- **Admin / Owner** — kelola produk, stok, lihat laporan, plus semua fitur kasir.
- **Kasir** — transaksi (kasir), stok, buka/tutup shift. Tidak bisa lihat laporan.

## 2. Mulai pertama kali

1. Buka aplikasi → halaman **Login**. Klik **Daftar** untuk membuat admin + toko
   pertama (nama toko, nama, email, password).
2. Login. Anda masuk ke **Ringkasan**.

## 3. Siapkan katalog & stok

1. Menu **Produk** → **Tambah Produk** (nama, harga; opsional SKU, barcode,
   kategori, varian). Simpan.
2. Menu **Stok** → baris produk → **Atur** → jenis **Barang masuk**, isi jumlah,
   alasan → **Simpan**. Riwayat tiap perubahan ada di tombol **Riwayat**.
   Penanda **menipis** muncul saat stok ≤ 5, **habis** saat 0.

## 4. Buka shift (kasir)

1. Di pojok kanan atas (topbar) klik chip **Buka shift**.
2. Isi **kas awal** (modal laci) → **Buka Shift**. Chip berubah jadi
   "Shift buka · <total penjualan berjalan>".

## 5. Transaksi (jual → bayar → struk)

1. Menu **Kasir**. Cari/scan produk di kiri → klik untuk masuk keranjang.
2. Atur **qty** (±, dibatasi stok), **diskon per item**, **diskon nota**, dan
   **pajak/service (%)** bila perlu. Total terhitung otomatis.
3. **Bayar** → pilih metode:
   - **Tunai** — isi uang diterima (atau tombol nominal), lihat **kembalian**.
   - **QRIS** — tampilkan QR (statis) lalu **Tandai Lunas**.
   - **E-Wallet / Transfer** — konfirmasi diterima lalu **Tandai Lunas**.
4. Layar **sukses** muncul (nota #, total, bayar, kembalian). Klik
   **Lihat / cetak struk** untuk membuka struk.
5. Di halaman struk: pilih lebar **58/80mm**, **Cetak / PDF** (dialog cetak
   browser; pilih "Save as PDF" untuk PDF), atau **Bagikan** (tautan struk).

> Checkout mengurangi stok secara transaksional dan mencatat pergerakan stok.
> Stok tak cukup → transaksi ditolak.

## 6. Tutup shift

1. Klik chip **Shift buka** → modal **Tutup Shift** menampilkan rekap berjalan
   (jumlah transaksi, tunai, non-tunai, kas seharusnya).
2. Isi **kas akhir** hasil hitung fisik → lihat **selisih** → **Tutup Shift**.

## 7. Laporan (admin/owner)

Menu **Laporan** → pilih rentang (**Hari ini / 7 / 30 hari** atau tanggal
manual). Tampil: kartu ringkasan (total, transaksi, rata-rata, diskon),
**penjualan harian**, **produk terlaris**, dan **ringkasan per metode bayar**.

---

## Lampiran — Alur uji end-to-end (terverifikasi)

Diuji pada stack live (jual → bayar → struk → laporan):

| Langkah | Aksi | Hasil |
|--------|------|-------|
| 1 | Daftar admin + toko | token terbit |
| 2 | Login | token valid |
| 3 | Tambah produk Kopi Susu @ Rp15.000 | tersimpan |
| 4 | Stok masuk 10 | stok = 10 |
| 5 | Checkout 3 pcs, pajak 11%, tunai Rp50.000 | total Rp49.950, kembalian Rp50, nota #1 |
| 6 | Buka struk | header toko + item tampil |
| 7 | Cek stok | 10 − 3 = 7 |
| 8 | Laporan harian | total Rp49.950, 1 transaksi, pajak Rp4.950 |
| 9 | Per metode bayar | tunai 1× Rp49.950 (bersih) |
| 10 | Produk terlaris | Kopi Susu 3 pcs, Rp45.000 |
| 11 | Akses laporan tanpa token | HTTP 401 (RBAC) |
