package transaction

import (
	"context"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mzpos/backend/internal/promo"
)

var (
	ErrEmpty            = errors.New("keranjang kosong")
	ErrProductNotFound  = errors.New("produk tidak ditemukan")
	ErrNotFound         = errors.New("transaksi tidak ditemukan")
	ErrInvalidMethod    = errors.New("metode pembayaran tidak valid")
	ErrPaymentShort     = errors.New("pembayaran kurang dari total")
	ErrCustomerNotFound = errors.New("member tidak ditemukan")
	ErrInvalidQty       = errors.New("qty harus lebih dari nol")
	ErrVariantNotFound  = errors.New("varian tidak ditemukan")
)

// rowQuerier dipenuhi oleh *pgxpool.Pool maupun pgx.Tx.
type rowQuerier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// resolveLine menentukan nama & harga satu baris: harga produk, di-override oleh
// harga varian bila varian dipilih & punya harga. Dipakai bersama Create & Quote
// agar harga pratinjau == harga checkout. Stok tetap di level produk.
func resolveLine(ctx context.Context, q rowQuerier, storeID string, it ItemInput) (name string, price int64, variantID *string, err error) {
	if it.ProductID == "" {
		return "", 0, nil, ErrProductNotFound
	}
	err = q.QueryRow(ctx,
		`SELECT name, price FROM products WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
		it.ProductID, storeID).Scan(&name, &price)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", 0, nil, ErrProductNotFound
	}
	if err != nil {
		return "", 0, nil, err
	}
	if it.VariantID != "" {
		var vname string
		var vprice *int64
		err = q.QueryRow(ctx,
			`SELECT name, price FROM variants WHERE id = $1 AND product_id = $2`,
			it.VariantID, it.ProductID).Scan(&vname, &vprice)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", 0, nil, ErrVariantNotFound
		}
		if err != nil {
			return "", 0, nil, err
		}
		name = name + " - " + vname
		if vprice != nil {
			price = *vprice
		}
		vid := it.VariantID
		variantID = &vid
	}
	return name, price, variantID, nil
}

// Totals = rincian perhitungan nota (dipakai bersama oleh checkout & quote).
type Totals struct {
	Subtotal       int64   `json:"subtotal"`
	Discount       int64   `json:"discount"`       // diskon nota (setelah clamp)
	PromoDiscount  int64   `json:"promo_discount"` // diskon promo otomatis
	TaxPercent     float64 `json:"tax_percent"`
	Tax            int64   `json:"tax"`
	ServicePercent float64 `json:"service_percent"`
	Service        int64   `json:"service_charge"`
	Total          int64   `json:"total"`
}

// finalize menghitung diskon nota, promo, pajak, service, dan total dari
// subtotal (jumlah line total sesudah diskon item). Urutan: diskon nota →
// promo → pajak/service atas sisa. Semua langkah dijaga tak negatif. Dipakai
// oleh Create (checkout) maupun Quote (pratinjau) agar hasilnya identik.
func finalize(subtotal, notaDiscIn int64, taxPctIn, svcPctIn float64, promoDisc int64) Totals {
	notaDisc := min(clampNonNeg(notaDiscIn), subtotal)
	promoDisc = min(clampNonNeg(promoDisc), subtotal-notaDisc)
	afterDisc := subtotal - notaDisc - promoDisc
	taxPct := clampPercent(taxPctIn)
	svcPct := clampPercent(svcPctIn)
	tax := int64(math.Round(float64(afterDisc) * taxPct / 100))
	svc := int64(math.Round(float64(afterDisc) * svcPct / 100))
	return Totals{
		Subtotal: subtotal, Discount: notaDisc, PromoDiscount: promoDisc,
		TaxPercent: taxPct, Tax: tax, ServicePercent: svcPct, Service: svc,
		Total: afterDisc + tax + svc,
	}
}

// InsufficientStockError menandai stok kurang untuk satu produk.
type InsufficientStockError struct {
	Name      string
	Available int64
	Requested int64
}

func (e *InsufficientStockError) Error() string {
	return fmt.Sprintf("stok %q tidak cukup (tersedia %d, diminta %d)", e.Name, e.Available, e.Requested)
}

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// clampNonNeg membatasi nilai minimal 0.
func clampNonNeg(v int64) int64 {
	if v < 0 {
		return 0
	}
	return v
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

// getByClientID mengambil transaksi berdasar client_id (nil bila belum ada).
func (r *Repository) getByClientID(ctx context.Context, storeID, clientID string) (*Transaction, error) {
	var id string
	err := r.db.QueryRow(ctx,
		`SELECT id FROM transactions WHERE store_id = $1 AND client_id = $2`,
		storeID, clientID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return r.Get(ctx, storeID, id)
}

// Create membuat transaksi: validasi stok, kurangi stok + catat pergerakan,
// hitung total secara otoritatif, semuanya dalam satu transaksi DB.
func (r *Repository) Create(ctx context.Context, in CreateInput) (*Transaction, error) {
	if len(in.Items) == 0 {
		return nil, ErrEmpty
	}
	if !in.Method.valid() {
		return nil, ErrInvalidMethod
	}

	// Idempotensi sync offline: bila client_id sudah pernah masuk, kembalikan
	// transaksi yang ada (skip pembuatan dobel).
	if in.ClientID != "" {
		if existing, err := r.getByClientID(ctx, in.StoreID, in.ClientID); err != nil {
			return nil, err
		} else if existing != nil {
			return existing, nil
		}
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback no-op bila sudah commit

	// Serialkan penomoran nota & mutasi stok per toko.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, in.StoreID); err != nil {
		return nil, err
	}

	items := make([]Item, 0, len(in.Items))
	var subtotal int64
	// Stok di level produk: satu produk bisa muncul di beberapa baris (varian
	// berbeda). Akumulasi qty diminta per produk agar gabungan tak melebihi stok
	// (cek & pengurangan stok ada di dua loop terpisah).
	reserved := make(map[string]int64, len(in.Items))
	for _, it := range in.Items {
		if it.Qty <= 0 {
			return nil, ErrInvalidQty
		}

		// Snapshot nama & harga (varian override bila dipilih).
		name, price, variantID, err := resolveLine(ctx, tx, in.StoreID, it)
		if err != nil {
			return nil, err
		}

		// Kunci & ambil stok (level produk, 0 bila belum ada baris).
		var stock int64
		err = tx.QueryRow(ctx,
			`SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE`, it.ProductID).Scan(&stock)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		reserved[it.ProductID] += it.Qty
		if stock < reserved[it.ProductID] {
			return nil, &InsufficientStockError{Name: name, Available: stock, Requested: reserved[it.ProductID]}
		}

		lineSubtotal := price * it.Qty
		disc := min(clampNonNeg(it.Discount), lineSubtotal)
		lineTotal := lineSubtotal - disc
		subtotal += lineTotal

		pid := it.ProductID
		items = append(items, Item{
			ProductID: &pid, VariantID: variantID, Name: name, Price: price, Qty: it.Qty,
			Discount: disc, LineTotal: lineTotal,
		})
	}

	// Promo otomatis: ambil promo aktif lalu hitung diskon (server otoritatif).
	promoLines := make([]promo.Line, 0, len(items))
	for _, it := range items {
		pid := ""
		if it.ProductID != nil {
			pid = *it.ProductID
		}
		promoLines = append(promoLines, promo.Line{ProductID: pid, Qty: it.Qty, LineTotal: it.LineTotal})
	}
	promos, err := promo.QueryActive(ctx, tx, in.StoreID)
	if err != nil {
		return nil, err
	}
	promoDisc := promo.Compute(promoLines, subtotal, time.Now().Hour(), promos).Discount

	// Diskon nota, promo, pajak/service, total — lewat helper bersama.
	ft := finalize(subtotal, in.Discount, in.TaxPercent, in.ServicePercent, promoDisc)

	// Pembayaran wajib menutup total. Kembalian hanya relevan untuk tunai.
	if in.PaidAmount < ft.Total {
		return nil, ErrPaymentShort
	}
	change := in.PaidAmount - ft.Total

	// Nomor nota berikutnya (aman di bawah advisory lock).
	var number int64
	if err := tx.QueryRow(ctx,
		`SELECT COALESCE(MAX(number), 0) + 1 FROM transactions WHERE store_id = $1`,
		in.StoreID).Scan(&number); err != nil {
		return nil, err
	}

	var cashierID *string
	if in.CashierID != "" {
		cashierID = &in.CashierID
	}
	var clientID *string
	if in.ClientID != "" {
		clientID = &in.ClientID
	}

	// Member opsional: validasi milik toko ini, lalu hitung poin dari nilai
	// belanja barang (subtotal − diskon − promo), TIDAK termasuk pajak/service.
	var customerID *string
	var pointsEarned int64
	if in.CustomerID != "" {
		var exists bool
		err := tx.QueryRow(ctx,
			`SELECT TRUE FROM customers WHERE id = $1 AND store_id = $2`,
			in.CustomerID, in.StoreID).Scan(&exists)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrCustomerNotFound
		}
		if err != nil {
			return nil, err
		}
		cid := in.CustomerID
		customerID = &cid
		merchandise := ft.Total - ft.Tax - ft.Service // = afterDisc
		pointsEarned = merchandise / RupiahPerPoint
	}

	var txID string
	err = tx.QueryRow(ctx,
		`INSERT INTO transactions
		 (store_id, cashier_id, customer_id, points_earned, client_id, number, subtotal,
		  discount, promo_discount, tax_percent, tax, service_percent, service_charge, total, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
		 RETURNING id`,
		in.StoreID, cashierID, customerID, pointsEarned, clientID, number, subtotal,
		ft.Discount, ft.PromoDiscount, ft.TaxPercent, ft.Tax, ft.ServicePercent, ft.Service,
		ft.Total, StatusSelesai).Scan(&txID)
	if err != nil {
		// Balapan sync: client_id sudah ada → kembalikan yang tersimpan.
		if in.ClientID != "" && isUniqueViolation(err) {
			if existing, gErr := r.getByClientID(ctx, in.StoreID, in.ClientID); gErr == nil && existing != nil {
				return existing, nil
			}
		}
		return nil, err
	}

	for i := range items {
		item := &items[i]
		if _, err := tx.Exec(ctx,
			`INSERT INTO transaction_items
			 (transaction_id, product_id, variant_id, name, price, qty, discount, line_total, line_no)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			txID, item.ProductID, item.VariantID, item.Name, item.Price, item.Qty,
			item.Discount, item.LineTotal, i+1); err != nil {
			return nil, err
		}

		// Kurangi stok + catat pergerakan (audit trail).
		if _, err := tx.Exec(ctx,
			`UPDATE inventory SET quantity = quantity - $1, updated_at = now()
			 WHERE product_id = $2`, item.Qty, item.ProductID); err != nil {
			return nil, err
		}
		reason := fmt.Sprintf("penjualan nota #%d", number)
		if _, err := tx.Exec(ctx,
			`INSERT INTO stock_movements
			 (store_id, product_id, type, delta, qty_after, reason, user_id)
			 VALUES ($1,$2,'keluar',$3,
			         COALESCE((SELECT quantity FROM inventory WHERE product_id = $2), 0),
			         $4,$5)`,
			in.StoreID, item.ProductID, -item.Qty, reason, nullify(in.CashierID)); err != nil {
			return nil, err
		}
	}

	// Catat pembayaran (atomik dengan nota).
	if _, err := tx.Exec(ctx,
		`INSERT INTO payments (transaction_id, store_id, method, amount, change_amount)
		 VALUES ($1,$2,$3,$4,$5)`,
		txID, in.StoreID, in.Method, in.PaidAmount, change); err != nil {
		return nil, err
	}

	// Akumulasi poin member (atomik): tambah saldo + catat buku besar 'earn'.
	if customerID != nil && pointsEarned > 0 {
		var newBal int64
		if err := tx.QueryRow(ctx,
			`UPDATE customers SET points = points + $2, updated_at = now()
			 WHERE id = $1 RETURNING points`, *customerID, pointsEarned).Scan(&newBal); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO loyalty_points (customer_id, type, points, balance_after, transaction_id, note)
			 VALUES ($1, 'earn', $2, $3, $4, $5)`,
			*customerID, pointsEarned, newBal, txID,
			fmt.Sprintf("nota #%d", number)); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, in.StoreID, txID)
}

// Quote menghitung rincian nota (subtotal, diskon, promo, pajak, total) TANPA
// menyimpan apa pun. Memakai harga & promo aktif yang sama dengan checkout,
// lewat helper finalize yang sama, sehingga total pratinjau == total checkout.
// Tidak memvalidasi stok (sekadar estimasi harga untuk kasir).
func (r *Repository) Quote(ctx context.Context, in QuoteInput) (*Totals, error) {
	var subtotal int64
	lines := make([]promo.Line, 0, len(in.Items))
	for _, it := range in.Items {
		if it.Qty <= 0 {
			return nil, ErrInvalidQty
		}
		_, price, _, err := resolveLine(ctx, r.db, in.StoreID, it)
		if err != nil {
			return nil, err
		}
		lineSubtotal := price * it.Qty
		disc := min(clampNonNeg(it.Discount), lineSubtotal)
		lineTotal := lineSubtotal - disc
		subtotal += lineTotal
		lines = append(lines, promo.Line{ProductID: it.ProductID, Qty: it.Qty, LineTotal: lineTotal})
	}
	promos, err := promo.QueryActive(ctx, r.db, in.StoreID)
	if err != nil {
		return nil, err
	}
	promoDisc := promo.Compute(lines, subtotal, time.Now().Hour(), promos).Discount
	ft := finalize(subtotal, in.Discount, in.TaxPercent, in.ServicePercent, promoDisc)
	return &ft, nil
}

// Get mengambil satu transaksi lengkap dengan item & nama kasir.
func (r *Repository) Get(ctx context.Context, storeID, id string) (*Transaction, error) {
	t := &Transaction{}
	err := r.db.QueryRow(ctx,
		`SELECT t.id, t.store_id, s.name, s.address, s.phone, t.cashier_id, u.name,
		        t.customer_id, cu.name, t.points_earned,
		        t.number, t.subtotal, t.discount, t.promo_discount, t.tax_percent, t.tax,
		        t.service_percent, t.service_charge, t.total, t.status, t.created_at
		 FROM transactions t
		 JOIN stores s ON s.id = t.store_id
		 LEFT JOIN users u ON u.id = t.cashier_id
		 LEFT JOIN customers cu ON cu.id = t.customer_id
		 WHERE t.id = $1 AND t.store_id = $2`, id, storeID).
		Scan(&t.ID, &t.StoreID, &t.StoreName, &t.StoreAddress, &t.StorePhone,
			&t.CashierID, &t.CashierName, &t.CustomerID, &t.CustomerName, &t.PointsEarned,
			&t.Number, &t.Subtotal,
			&t.Discount, &t.PromoDiscount, &t.TaxPercent, &t.Tax, &t.ServicePercent, &t.ServiceCharge,
			&t.Total, &t.Status, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx,
		`SELECT id, product_id, variant_id, name, price, qty, discount, line_total
		 FROM transaction_items WHERE transaction_id = $1 ORDER BY line_no, created_at, id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	t.Items = []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.ProductID, &it.VariantID, &it.Name, &it.Price, &it.Qty,
			&it.Discount, &it.LineTotal); err != nil {
			return nil, err
		}
		t.Items = append(t.Items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Pembayaran (boleh tidak ada untuk nota lama; MVP selalu ada).
	var p Payment
	err = r.db.QueryRow(ctx,
		`SELECT method, amount, change_amount FROM payments
		 WHERE transaction_id = $1 ORDER BY created_at LIMIT 1`, id).
		Scan(&p.Method, &p.Amount, &p.Change)
	if err == nil {
		t.Payment = &p
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	return t, nil
}

// clampPercent membatasi persen ke rentang 0..100.
func clampPercent(p float64) float64 {
	if p < 0 {
		return 0
	}
	if p > 100 {
		return 100
	}
	return p
}

func nullify(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
