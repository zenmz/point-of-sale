package inventory

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrProductNotFound = errors.New("produk tidak ditemukan")
	ErrInsufficient    = errors.New("stok tidak mencukupi")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ListInventory mengembalikan stok semua produk aktif per toko (0 bila belum
// pernah diatur). Opsional filter pencarian nama/sku.
func (r *Repository) ListInventory(ctx context.Context, storeID, search string) ([]Item, error) {
	rows, err := r.db.Query(ctx,
		`SELECT p.id, p.name, p.sku,
		        COALESCE(i.quantity, 0) AS quantity,
		        COALESCE(i.updated_at, p.created_at) AS updated_at
		 FROM products p
		 LEFT JOIN inventory i ON i.product_id = p.id
		 WHERE p.store_id = $1 AND p.is_active = TRUE
		   AND ($2 = '' OR p.name ILIKE '%'||$2||'%' OR p.sku ILIKE '%'||$2||'%')
		 ORDER BY p.name`, storeID, search)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []Item{}
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.ProductID, &it.Name, &it.SKU, &it.Quantity, &it.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

// ListMovements mengambil riwayat pergerakan stok satu produk (terbaru dulu).
func (r *Repository) ListMovements(ctx context.Context, storeID, productID string) ([]Movement, error) {
	rows, err := r.db.Query(ctx,
		`SELECT m.id, m.product_id, m.type, m.delta, m.qty_after, m.reason,
		        u.name, m.created_at
		 FROM stock_movements m
		 LEFT JOIN users u ON u.id = m.user_id
		 WHERE m.store_id = $1 AND m.product_id = $2
		 ORDER BY m.created_at DESC, m.id DESC`, storeID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	moves := []Movement{}
	for rows.Next() {
		var m Movement
		if err := rows.Scan(&m.ID, &m.ProductID, &m.Type, &m.Delta, &m.QtyAfter,
			&m.Reason, &m.UserName, &m.CreatedAt); err != nil {
			return nil, err
		}
		moves = append(moves, m)
	}
	return moves, rows.Err()
}

// Adjust menerapkan perubahan stok secara transaksional: kunci baris inventory,
// hitung qty baru, upsert, lalu catat satu stock_movement. qty adalah jumlah
// untuk masuk/keluar atau nilai target untuk penyesuaian.
func (r *Repository) Adjust(ctx context.Context, storeID, productID, userID string, typ MovementType, qty int64, reason *string) (*Movement, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck // rollback no-op bila sudah commit

	// Pastikan produk milik toko ini & masih aktif.
	var exists bool
	err = tx.QueryRow(ctx,
		`SELECT TRUE FROM products WHERE id = $1 AND store_id = $2 AND is_active = TRUE`,
		productID, storeID).Scan(&exists)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrProductNotFound
	}
	if err != nil {
		return nil, err
	}

	// Kunci baris stok saat ini (0 bila belum ada).
	var old int64
	err = tx.QueryRow(ctx,
		`SELECT quantity FROM inventory WHERE product_id = $1 FOR UPDATE`, productID).Scan(&old)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, err
	}

	newQty, delta := apply(typ, old, qty)
	if newQty < 0 {
		return nil, ErrInsufficient
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO inventory (product_id, store_id, quantity, updated_at)
		 VALUES ($1, $2, $3, now())
		 ON CONFLICT (product_id)
		 DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now()`,
		productID, storeID, newQty); err != nil {
		return nil, err
	}

	m := &Movement{ProductID: productID, Type: typ, Delta: delta, QtyAfter: newQty, Reason: reason}
	err = tx.QueryRow(ctx,
		`INSERT INTO stock_movements (store_id, product_id, type, delta, qty_after, reason, user_id)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING id, created_at`,
		storeID, productID, typ, delta, newQty, reason, nullify(userID)).
		Scan(&m.ID, &m.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return m, nil
}

// apply menghitung qty baru dan delta sesuai jenis pergerakan.
func apply(typ MovementType, old, qty int64) (newQty, delta int64) {
	switch typ {
	case Masuk:
		return old + qty, qty
	case Keluar:
		return old - qty, -qty
	default: // Penyesuaian: qty = nilai absolut target
		return qty, qty - old
	}
}

// nullify mengubah string kosong jadi nil agar kolom user_id bisa NULL.
func nullify(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
