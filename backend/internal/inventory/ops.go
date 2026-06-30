package inventory

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	ErrDestProductNotFound = errors.New("produk padanan tidak ada di cabang tujuan")
	ErrStoreNotFound       = errors.New("cabang tujuan tidak ditemukan")
	ErrSameStore           = errors.New("cabang tujuan harus berbeda dari sumber")
	ErrNegativePhysical    = errors.New("jumlah fisik tidak boleh negatif")
)

// Transfer = catatan transfer stok antar cabang (dengan nama untuk tampilan).
type Transfer struct {
	ID            string    `json:"id"`
	FromStoreID   string    `json:"from_store_id"`
	FromStoreName string    `json:"from_store_name"`
	ToStoreID     string    `json:"to_store_id"`
	ToStoreName   string    `json:"to_store_name"`
	ProductID     string    `json:"product_id"`
	ProductName   string    `json:"product_name"`
	Qty           int64     `json:"qty"`
	Note          *string   `json:"note"`
	CreatedAt     time.Time `json:"created_at"`
}

// ListTransfers mengembalikan transfer yang melibatkan cabang (masuk/keluar).
func (r *Repository) ListTransfers(ctx context.Context, storeID string) ([]Transfer, error) {
	rows, err := r.db.Query(ctx,
		`SELECT st.id, st.from_store_id, fs.name, st.to_store_id, ts.name,
		        st.from_product_id, p.name, st.qty, st.note, st.created_at
		 FROM stock_transfers st
		 JOIN stores fs ON fs.id = st.from_store_id
		 JOIN stores ts ON ts.id = st.to_store_id
		 JOIN products p ON p.id = st.from_product_id
		 WHERE st.from_store_id = $1 OR st.to_store_id = $1
		 ORDER BY st.created_at DESC
		 LIMIT 100`, storeID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Transfer{}
	for rows.Next() {
		var t Transfer
		if err := rows.Scan(&t.ID, &t.FromStoreID, &t.FromStoreName, &t.ToStoreID, &t.ToStoreName,
			&t.ProductID, &t.ProductName, &t.Qty, &t.Note, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// TransferStock memindahkan stok satu produk dari cabang sumber ke cabang
// tujuan dalam satu transaksi: kunci stok sumber, kurangi (keluar), cari produk
// padanan di tujuan (via SKU bila ada, jika tidak via nama), tambah (masuk),
// lalu catat baris stock_transfers + dua stock_movement.
func (r *Repository) TransferStock(ctx context.Context, fromStore, toStore, productID, userID string, qty int64, note *string) (*Transfer, error) {
	if fromStore == toStore {
		return nil, ErrSameStore
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	// Cabang tujuan harus ada & aktif.
	var toName string
	err = tx.QueryRow(ctx,
		`SELECT name FROM stores WHERE id = $1 AND is_active = TRUE`, toStore).Scan(&toName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrStoreNotFound
	}
	if err != nil {
		return nil, err
	}

	// Produk sumber milik cabang sumber & aktif.
	var name string
	var sku *string
	err = tx.QueryRow(ctx,
		`SELECT name, sku FROM products WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
		productID, fromStore).Scan(&name, &sku)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProductNotFound
	}
	if err != nil {
		return nil, err
	}

	// Cari produk padanan di tujuan: SKU sama dulu, lalu nama sama (apa pun SKU
	// sumber). Tiebreak deterministik: cocok-SKU dulu, lalu produk terlama.
	var toProductID string
	err = tx.QueryRow(ctx,
		`SELECT id FROM products
		 WHERE store_id = $1 AND is_active = TRUE
		   AND ((sku IS NOT NULL AND sku = $2) OR name = $3)
		 ORDER BY (sku IS NOT DISTINCT FROM $2) DESC, created_at
		 LIMIT 1`,
		toStore, sku, name).Scan(&toProductID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDestProductNotFound
	}
	if err != nil {
		return nil, err
	}

	// Kurangi stok sumber (kunci baris). Wajib cukup.
	var fromQty int64
	err = tx.QueryRow(ctx,
		`SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE`, productID).Scan(&fromQty)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}
	if fromQty < qty {
		return nil, ErrInsufficient
	}
	if err := applyDelta(ctx, tx, fromStore, productID, userID, Keluar, -qty, fromQty-qty,
		ptr("transfer ke "+toName)); err != nil {
		return nil, err
	}

	// Tambah stok tujuan secara relatif (atomik; aman walau baris belum ada &
	// terhadap transfer paralel — tak ada lost-update seperti set absolut).
	if err := addStock(ctx, tx, toStore, toProductID, userID, qty,
		ptr("transfer dari cabang sumber")); err != nil {
		return nil, err
	}

	// Catat transfer.
	t := &Transfer{
		FromStoreID: fromStore, ToStoreID: toStore, ToStoreName: toName,
		ProductID: productID, ProductName: name, Qty: qty, Note: note,
	}
	err = tx.QueryRow(ctx,
		`INSERT INTO stock_transfers
		 (from_store_id, to_store_id, from_product_id, to_product_id, qty, note, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
		fromStore, toStore, productID, toProductID, qty, note, nullify(userID)).
		Scan(&t.ID, &t.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return t, nil
}

// addStock menambah stok secara relatif (atomik) lalu mencatat movement 'masuk'.
// Tahan terhadap baris belum ada & penambahan paralel (tanpa lost-update).
func addStock(ctx context.Context, tx pgx.Tx, storeID, productID, userID string, qty int64, reason *string) error {
	var newQty int64
	if err := tx.QueryRow(ctx,
		`INSERT INTO inventory (product_id, store_id, quantity, updated_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (product_id)
		 DO UPDATE SET quantity = inventory.quantity + EXCLUDED.quantity, updated_at = now()
		 RETURNING quantity`,
		productID, storeID, qty).Scan(&newQty); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO stock_movements (store_id, product_id, type, delta, qty_after, reason, user_id)
		 VALUES ($1, $2, 'masuk', $3, $4, $5, $6)`,
		storeID, productID, qty, newQty, reason, nullify(userID))
	return err
}

// applyDelta meng-upsert stok ke nilai baru lalu mencatat satu stock_movement.
func applyDelta(ctx context.Context, tx pgx.Tx, storeID, productID, userID string, typ MovementType, delta, newQty int64, reason *string) error {
	if _, err := tx.Exec(ctx,
		`INSERT INTO inventory (product_id, store_id, quantity, updated_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (product_id)
		 DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
		productID, storeID, newQty); err != nil {
		return err
	}
	_, err := tx.Exec(ctx,
		`INSERT INTO stock_movements (store_id, product_id, type, delta, qty_after, reason, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		storeID, productID, typ, delta, newQty, reason, nullify(userID))
	return err
}

// ---- Opname (audit stok fisik vs sistem) ----

// OpnameItem = hitungan fisik satu produk.
type OpnameItem struct {
	ProductID string `json:"product_id"`
	Physical  int64  `json:"physical"`
}

// OpnameResult = hasil per produk: stok sistem, fisik, dan selisihnya.
type OpnameResult struct {
	ProductID  string `json:"product_id"`
	Name       string `json:"name"`
	SystemQty  int64  `json:"system_qty"`
	Physical   int64  `json:"physical"`
	Difference int64  `json:"difference"` // fisik − sistem
}

// Opname menyamakan stok sistem dengan hitungan fisik. Untuk tiap item yang
// selisihnya ≠ 0, terapkan penyesuaian (set absolut) + catat movement 'opname'.
// Semua dalam satu transaksi; mengembalikan rincian selisih tiap produk.
func (r *Repository) Opname(ctx context.Context, storeID, userID string, items []OpnameItem) ([]OpnameResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	results := make([]OpnameResult, 0, len(items))
	for _, it := range items {
		if it.Physical < 0 {
			return nil, ErrNegativePhysical
		}
		var name string
		err := tx.QueryRow(ctx,
			`SELECT name FROM products WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
			it.ProductID, storeID).Scan(&name)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProductNotFound
		}
		if err != nil {
			return nil, err
		}

		var system int64
		err = tx.QueryRow(ctx,
			`SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE`, it.ProductID).Scan(&system)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}

		diff := it.Physical - system
		if diff != 0 {
			if err := applyDelta(ctx, tx, storeID, it.ProductID, userID, Penyesuaian, diff,
				it.Physical, ptr("opname")); err != nil {
				return nil, err
			}
		}
		results = append(results, OpnameResult{
			ProductID: it.ProductID, Name: name, SystemQty: system,
			Physical: it.Physical, Difference: diff,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return results, nil
}

func ptr(s string) *string { return &s }
