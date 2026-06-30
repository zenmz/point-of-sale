# MZ POS — Panduan Penggunaan

**Tanggal:** 2026-06-29 (diperbarui untuk Fase 1–3).

Panduan singkat alur pakai harian. Untuk arsitektur lihat
[Desain](./2026-06-18-mz-pos-design.md). Bagian 1–7 = operasi harian inti;
8–14 = multi-toko, member, promo, pembelian, transfer/opname, analitik, hardware.

---

## 1. Peran

- **Owner** — pemilik usaha. Semua akses, **lintas cabang**: kelola cabang,
  pindah cabang aktif, kelola pengguna semua cabang, transfer stok antar cabang,
  laporan gabungan.
- **Admin** — kelola produk, stok, promo, pembelian, laporan, kelola pengguna
  **cabang sendiri**, plus semua fitur kasir.
- **Kasir** — transaksi, stok, buka/tutup shift, daftar/cari member. Tidak bisa
  lihat laporan/analitik atau kelola promo/pembelian.

## 2. Mulai pertama kali

1. Buka aplikasi → halaman **Login**. Klik **Daftar** untuk membuat **owner
   (pemilik) + toko pertama** (nama toko, nama, email, password).
2. Login. Anda masuk ke **Ringkasan** (untuk admin/owner berisi analitik 14 hari).

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
   (Barcode scanner mode keyboard-wedge otomatis menambah produk; pastikan
   tak ada kolom teks yang sedang fokus.)
2. Atur **qty** (±, dibatasi stok), **diskon per item**, **diskon nota**, dan
   **pajak/service (%)** bila perlu. Total terhitung otomatis & otoritatif dari
   server (termasuk **promo otomatis** yang aktif — tampil sebagai baris "Promo").
   Opsional **+ Tambahkan member** untuk akumulasi poin.
3. **Bayar** → pilih metode:
   - **Tunai** — isi uang diterima (atau tombol nominal), lihat **kembalian**.
   - **QRIS** — tampilkan QR (statis) lalu **Tandai Lunas**.
   - **E-Wallet / Transfer** — konfirmasi diterima lalu **Tandai Lunas**.
4. Layar **sukses** muncul (nota #, total, bayar, kembalian). Klik
   **Lihat / cetak struk** untuk membuka struk.
5. Di halaman struk: pilih lebar **58/80mm**, **Cetak / PDF** (dialog cetak
   browser; pilih "Save as PDF" untuk PDF), atau **Bagikan** (tautan struk).
   Struk mencantumkan diskon, **promo**, **member & poin** bila ada.
6. **Hardware opsional** (di layar sukses kasir): **Cetak thermal** (printer USB
   ESC/POS via WebUSB), **Buka laci** (cash drawer lewat printer). Tombol
   **🖥 Layar pelanggan** membuka jendela kedua untuk monitor menghadap pelanggan.

> Checkout mengurangi stok secara transaksional dan mencatat pergerakan stok.
> Stok tak cukup → transaksi ditolak. Total dihitung ulang otoritatif di server.

## 6. Tutup shift

1. Klik chip **Shift buka** → modal **Tutup Shift** menampilkan rekap berjalan
   (jumlah transaksi, tunai, non-tunai, kas seharusnya).
2. Isi **kas akhir** hasil hitung fisik → lihat **selisih** → **Tutup Shift**.

## 7. Laporan (admin/owner)

Menu **Laporan** → pilih rentang (**Hari ini / 7 / 30 hari** atau tanggal
manual). Tampil: kartu ringkasan (total, transaksi, rata-rata, diskon),
**penjualan harian**, **produk terlaris**, dan **ringkasan per metode bayar**.
**Owner**: dropdown **cabang** (Semua cabang = laporan gabungan + rincian
**Per cabang**).

## 8. Multi-toko (owner)

- **Pindah cabang:** chip cabang di topbar → pilih cabang. Semua data (produk,
  stok, transaksi, laporan) otomatis mengikuti cabang aktif.
- **Kelola cabang & pengguna:** menu **Pengaturan**. Owner: tambah/edit cabang,
  saat buat cabang bisa **salin katalog** dari cabang lain (produk+kategori+
  varian+harga modal; stok mulai 0). Kelola pengguna semua cabang. Admin: hanya
  pengguna cabang sendiri, tak bisa menetapkan role owner.

## 9. Member & poin (CRM)

- **Daftar/cari member:** menu **Pelanggan** atau lewat **+ Tambahkan member**
  di kasir. Kasir boleh daftar & cari; ubah data & tukar poin = admin/owner.
- **Poin** otomatis bertambah tiap transaksi member (1 poin / Rp1.000).
- **Rincian** member: saldo poin, riwayat beli, riwayat poin, tombol **Tukar**
  poin (admin/owner).

## 10. Promo (admin/owner)

Menu **Promo** → **Buat Promo**. Tiga jenis (diterapkan **otomatis** saat
checkout, dihitung server):

- **Diskon nota (%)** — berlaku bila belanja ≥ minimal.
- **Diskon qty produk (%)** — produk tertentu, qty ≥ minimal.
- **Happy hour (%)** — pada rentang jam.

> Promo level-nota (nota/happy hour) tidak menumpuk (ambil yang terbesar);
> promo produk menumpuk dengan promo nota.

## 11. Pembelian / Purchase Order (admin/owner)

Menu **Pembelian**:

1. Tab **Pemasok** → tambah pemasok.
2. Tab **Pesanan** → **Buat PO** (pilih pemasok, tambah item + qty + harga beli).
3. Buka PO → **Terima barang** (stok bertambah, harga modal produk diperbarui) →
   **Tandai lunas** saat dibayar. **Batalkan** hanya saat masih "dipesan".
4. Banner **hutang** = total PO sudah diterima tapi belum lunas.

## 12. Transfer stok & opname

- **Transfer (owner)** — halaman **Stok** → **Transfer**: pilih produk, cabang
  tujuan, qty. Produk dipadankan di tujuan via SKU lalu nama. Stok sumber
  berkurang, tujuan bertambah. Stok tak cukup → ditolak.
- **Opname (admin/owner)** — halaman **Stok** → **Opname**: isi jumlah fisik per
  produk; sistem menampilkan **selisih** dan menyesuaikan stok.

## 13. Dashboard analitik (admin/owner)

**Ringkasan** (home) menampilkan 14 hari terakhir: penjualan, **laba kotor**,
**margin %**, jumlah produk **perlu restok**, grafik **tren penjualan**, dan
tabel **alert stok** (perkiraan hari habis dari kecepatan jual). Margin memakai
**harga modal** produk (diisi di form produk atau otomatis dari penerimaan PO).

## 14. Hardware (kasir)

- **Printer thermal** (WebUSB/ESC-POS) & **cash drawer** — tombol di layar
  sukses kasir. Perlu browser Chromium + HTTPS/localhost + izin perangkat.
- **Barcode scanner** (keyboard-wedge) — otomatis menambah produk ke keranjang.
- **Layar pelanggan** — buka **🖥 Layar pelanggan** di monitor kedua (sinkron
  via BroadcastChannel, satu mesin).

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
