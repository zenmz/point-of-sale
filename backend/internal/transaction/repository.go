package transaction

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrEmpty           = errors.New("keranjang kosong")
	ErrProductNotFound = errors.New("produk tidak ditemukan")
	ErrNotFound        = errors.New("transaksi tidak ditemukan")
)

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

// Create membuat transaksi: validasi stok, kurangi stok + catat pergerakan,
// hitung total secara otoritatif, semuanya dalam satu transaksi DB.
func (r *Repository) Create(ctx context.Context, in CreateInput) (*Transaction, error) {
	if len(in.Items) == 0 {
		return nil, ErrEmpty
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
	for _, it := range in.Items {
		if it.Qty <= 0 {
			return nil, fmt.Errorf("qty harus lebih dari nol")
		}

		// Snapshot produk (harus aktif & milik toko).
		var name string
		var price int64
		err := tx.QueryRow(ctx,
			`SELECT name, price FROM products
			 WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
			it.ProductID, in.StoreID).Scan(&name, &price)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		if err != nil {
			return nil, err
		}

		// Kunci & ambil stok (0 bila belum ada baris).
		var stock int64
		err = tx.QueryRow(ctx,
			`SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE`, it.ProductID).Scan(&stock)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if stock < it.Qty {
			return nil, &InsufficientStockError{Name: name, Available: stock, Requested: it.Qty}
		}

		lineSubtotal := price * it.Qty
		disc := min(clampNonNeg(it.Discount), lineSubtotal)
		lineTotal := lineSubtotal - disc
		subtotal += lineTotal

		pid := it.ProductID
		items = append(items, Item{
			ProductID: &pid, Name: name, Price: price, Qty: it.Qty,
			Discount: disc, LineTotal: lineTotal,
		})
	}

	// Diskon nota & pajak/service dihitung dari subtotal setelah diskon item.
	notaDisc := min(clampNonNeg(in.Discount), subtotal)
	afterDisc := subtotal - notaDisc
	taxPct := clampPercent(in.TaxPercent)
	svcPct := clampPercent(in.ServicePercent)
	tax := int64(math.Round(float64(afterDisc) * taxPct / 100))
	service := int64(math.Round(float64(afterDisc) * svcPct / 100))
	total := afterDisc + tax + service

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

	var txID string
	err = tx.QueryRow(ctx,
		`INSERT INTO transactions
		 (store_id, cashier_id, number, subtotal, discount, tax_percent, tax,
		  service_percent, service_charge, total, status)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id`,
		in.StoreID, cashierID, number, subtotal, notaDisc, taxPct, tax,
		svcPct, service, total, StatusSelesai).Scan(&txID)
	if err != nil {
		return nil, err
	}

	for i := range items {
		item := &items[i]
		if _, err := tx.Exec(ctx,
			`INSERT INTO transaction_items
			 (transaction_id, product_id, name, price, qty, discount, line_total)
			 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
			txID, item.ProductID, item.Name, item.Price, item.Qty, item.Discount, item.LineTotal); err != nil {
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

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.Get(ctx, in.StoreID, txID)
}

// Get mengambil satu transaksi lengkap dengan item & nama kasir.
func (r *Repository) Get(ctx context.Context, storeID, id string) (*Transaction, error) {
	t := &Transaction{}
	err := r.db.QueryRow(ctx,
		`SELECT t.id, t.store_id, t.cashier_id, u.name, t.number, t.subtotal, t.discount,
		        t.tax_percent, t.tax, t.service_percent, t.service_charge, t.total,
		        t.status, t.created_at
		 FROM transactions t
		 LEFT JOIN users u ON u.id = t.cashier_id
		 WHERE t.id = $1 AND t.store_id = $2`, id, storeID).
		Scan(&t.ID, &t.StoreID, &t.CashierID, &t.CashierName, &t.Number, &t.Subtotal,
			&t.Discount, &t.TaxPercent, &t.Tax, &t.ServicePercent, &t.ServiceCharge,
			&t.Total, &t.Status, &t.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := r.db.Query(ctx,
		`SELECT id, product_id, name, price, qty, discount, line_total
		 FROM transaction_items WHERE transaction_id = $1 ORDER BY created_at, id`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	t.Items = []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ID, &it.ProductID, &it.Name, &it.Price, &it.Qty,
			&it.Discount, &it.LineTotal); err != nil {
			return nil, err
		}
		t.Items = append(t.Items, it)
	}
	return t, rows.Err()
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
